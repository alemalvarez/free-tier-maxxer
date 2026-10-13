# PostHog Cloud — free-tier usage API feasibility

**Verdict: FEASIBLE** (verified_at: 2026-10-11)

PostHog documents an org-level `GET /api/billing/` endpoint (scope `billing:read`) that returns per-product `current_usage` / `usage_limit` / `percentage_usage` plus `billing_period.current_period_start/end`, so usage-vs-limit can be read in one call with a personal API key held by an org owner. The remaining risk is empirical: the docs never state that a no-card free org gets populated product usage (the response type does carry `subscription_level: 'free'`), so this needs a live test; HogQL via the Query API is a workable fallback for events and recordings but not for feature-flag requests.

## 1. Documented usage endpoint

- **`GET /api/billing/`** — "List all billing", required scope `billing:read`. Documented in the official API reference: https://posthog.com/docs/api/billing (page is JS-rendered; read via browser). Example response keys shown on that page: `customer_id`, `billing_plan`, `subscription_level`, `has_active_subscription`, `deactivated`, `free_trial_until`, `current_total_amount_usd`, `projected_total_amount_usd`, `products`, `usage_summary`, `billing_period`, `custom_limits_usd`, `next_period_custom_limits_usd`.
- **`GET /api/billing/usage/`** — "Retrieve billing usage", scope `billing:read`, query params `start_date`, `end_date`, `usage_types`, `team_ids`, `breakdowns`, `interval` (+ paging); response includes `total_count`, `team_id_options`. **`GET /api/billing/spend/`** same scope. Documented: https://posthog.com/docs/api/billing-2
- Per-product field names are NOT listed in the docs (`products` is a list of untyped dicts in `BillingOverviewResponseSerializer`, https://raw.githubusercontent.com/PostHog/posthog/master/ee/api/billing.py). They are visible in source only (exists in source, undocumented): `frontend/src/types.ts` `BillingProductV2Type`: `type`, `usage_key`, `current_usage`, `free_allocation`, `usage_limit`, `percentage_usage`, `has_exceeded_limit`, `projected_usage`, `unit`, `tiers`, `subscribed`; `BillingType.billing_period`: `current_period_start`, `current_period_end`, `interval: 'month' | 'year'`; `subscription_level: 'free' | 'paid' | 'custom'`; `usage_summary: Record<usage_key, {usage, limit, todays_usage}>` — https://raw.githubusercontent.com/PostHog/posthog/master/frontend/src/types.ts
- How `current_usage` is built (source): `usage_summary[usage_key].usage + todays_usage`; `limit` -> `usage_limit`; `percentage_usage = current_usage / usage_limit` (0 if no limit) — https://raw.githubusercontent.com/PostHog/posthog/master/ee/billing/billing_manager.py (`get_billing`, `update_org_details`). The viewset proxies to PostHog's billing service `GET {BILLING_SERVICE_URL}/api/billing` using a short-lived JWT; the service's own schema is not public.
- Route registration: `root_router.register(r"billing", billing.BillingViewset, "billing")` — https://raw.githubusercontent.com/PostHog/posthog/master/ee/urls.py. There is no `/api/billing-v2/` route (not present in `ee/urls.py`).
- Products covered: whatever the billing service returns in `products[]` keyed by `usage_key`/`type` (events, recordings, feature flag requests, data pipelines, error tracking, surveys, LLM analytics are all billable products on the pricing page). Exact `usage_key` strings: `TODO(verify)` — not in docs; confirm from a live `/api/billing/` response.
- Not on the API overview page (https://posthog.com/docs/api.md) nor in the changelog search (https://posthog.com/changelog not found via search); the only doc location is the Billing API reference above.

## 2. Free tier / no credit card

- The viewset returns 404 only when the license is not v2 or the org has a legacy "Billing V1" Stripe subscription; otherwise it calls `get_billing` (source: ee/api/billing.py `list`). `BillingType.subscription_level` includes `'free'` (frontend/src/types.ts), so free orgs are a first-class state in the response.
- Docs: "PostHog is usage-based and you can use it for free for as long as you want, no trial needed" — https://posthog.com/docs/billing/common-questions.md; "No credit card required." — https://posthog.com/pricing.md
- `TODO(verify)`: run `GET https://us.posthog.com/api/billing/` on a no-card org and confirm `products[].current_usage`/`usage_limit` are populated (billing_manager falls back to `get_default_products()` with no usage if the service returns no customer).

## 3. Authentication and scopes

- Minimum scope: **`billing:read`** (stated on https://posthog.com/docs/api/billing and https://posthog.com/docs/api/billing-2). `organization:read` is not required for `/api/billing/`.
- Scope object `billing` exists in `API_SCOPE_OBJECTS`; scopes are `object:read` / `object:write`, `*` = full access — https://raw.githubusercontent.com/PostHog/posthog/master/posthog/scopes.py. Personal API keys doc only shows the `object:read` form and `*`, and the header `Authorization: Bearer <key>` — https://posthog.com/docs/api/personal-api-keys.md
- Membership gate (source, undocumented): for token-authenticated requests `list` calls `user_has_billing_access` — org **owners** always pass; **admins** only if the `owner-only-billing` flag evaluates to `False` (unknown state fails closed); members are denied — https://raw.githubusercontent.com/PostHog/posthog/master/ee/api/billing.py and https://raw.githubusercontent.com/PostHog/posthog/master/ee/billing/grants.py. Docs confirm: "By default, billing is only available to organization admins and owners" — https://posthog.com/docs/billing/common-questions.md. For a one-person side project the key holder is the owner, so this is fine.
- The key should be organization-scoped or unscoped (personal-api-keys doc: "organization-scoped, project-scoped, and unscoped keys"). `TODO(verify)`: whether a project-scoped key is rejected by `/api/billing/` (org-level resource).

## 4. Fallback: Query API (HogQL)

- `POST /api/projects/:project_id/query/` with body `{"query": {"kind": "HogQLQuery", "query": "SELECT count() FROM events WHERE timestamp >= ..."}}`; needs a personal API key "with the **Query Read** permission" (scope object `query`, i.e. `query:read`) — https://posthog.com/docs/api/queries.md
- Limits (same page): 2,400 requests/hour, 240/minute, 3 concurrent queries, 60 threads/query, 10 s max execution; queued when concurrency is exhausted. Personal-API-key queries also "draw from an hourly read budget per project" (bytes read); exhausted budget -> `429` with code `api_queries_budget_exceeded` and a `Retry-After` header; "Cached results still work"; budget size is not stated and "For the larger budget, subscribe to a paid plan". Endpoint "is not a supported export mechanism".
- Not billed as events: nothing on the queries page or pricing page says Query API calls consume any product quota; only the read budget and request limits apply.
- Recordings: HogQL table `raw_session_replay_events` with `session_id`, `min_first_timestamp` is documented — https://posthog.com/docs/data-warehouse/sql.md. Count with `SELECT uniq(session_id) FROM raw_session_replay_events WHERE min_first_timestamp >= ...` (the `uniq` requirement is my inference from the raw table being multi-row per session; `TODO(verify)` against a live project). The REST list endpoint page https://posthog.com/docs/api/session-recordings could not be read (JS-rendered, 1.7 KB of nav) — `TODO(verify)` its `count`/`date_from` params.
- Feature flag requests: billed by calls to `/flags`; "Feature flags are **not** billed based on `$feature_flag_called` events"; local-evaluation polls cost 10 requests when definitions changed, else 1 — https://posthog.com/docs/feature-flags/cutting-costs.md. There is no HogQL table of `/flags` calls, so flag-request usage is only available from `/api/billing/` (or `/api/billing/usage/`).

## 5. Billing period

- API fields: `billing_period.current_period_start`, `current_period_end`, `interval` (`'month' | 'year'`) — documented key on https://posthog.com/docs/api/billing, field names from frontend/src/types.ts. Use these rather than assuming an anchor.
- Docs only say "The free tier resets every month" (https://posthog.com/pricing.md) and refer to "the current billing period" (https://posthog.com/docs/billing/common-questions.md). Calendar month vs signup anniversary: `TODO(verify)` — not stated on pricing, docs/billing, common-questions or limits-alerts pages; read it from `billing_period` at runtime.

## 6. Free-tier limits (monthly)

Source: https://posthog.com/pricing.md — verified_at 2026-10-11. "No credit card required." "The free tier resets every month." Paid plan: "$0/mo base price", "You get a free tier on every product, then pay only for what you use above it."

| Product | Free per month | Unit |
|---|---|---|
| Product analytics | First 1,000,000 | events |
| Session replay | First 5,000 | recordings |
| Feature flags (Experiments share it) | First 1,000,000 | requests |
| Surveys | First 1,500 | survey responses |
| Data pipelines (Product Analytics add-on) | First 1,000,000 | events |
| Data warehouse | First 1,000,000 | rows |
| Error tracking | First 100,000 | exceptions |
| AI Observability (LLM analytics) | First 100,000 | events |
| Logs | First 10 | GB |
| Web analytics | included with Product Analytics | — |

## 7. Hosts

"You must make API requests to the correct domain." US: `https://us.i.posthog.com` (public ingestion/flags) vs `https://us.posthog.com` (private API). EU: `https://eu.i.posthog.com` vs `https://eu.posthog.com`. Use the non-`.i.` host for `/api/billing/` and `/api/projects/:id/query/` — https://posthog.com/docs/api.md

## 8. Rate limits (hourly polling)

From https://posthog.com/docs/api.md: analytics endpoints 240/min and 1,200/hour; `query` 2,400/hour (+ read budget); feature flag local evaluation 600/min; "other" create/read/update/delete endpoints 480/min and 4,800/hour; limits apply to the entire team, not per key. `/api/billing/` falls under the generic bucket (inference; not listed by name). Rate-limit response headers are not documented except `Retry-After` on the query-budget 429. One `/api/billing/` call per hour is far below every limit.

## Metric table

| Metric | Obtainable via API? | Endpoint | Notes |
|---|---|---|---|
| Events (current period) | Yes | `GET /api/billing/` -> `products[].current_usage`; fallback HogQL `count() FROM events` | Billing is authoritative (includes todays_usage) |
| Recordings | Yes | `GET /api/billing/`; fallback HogQL on `raw_session_replay_events` | `uniq(session_id)` TODO(verify) |
| Feature flag requests | Billing only | `GET /api/billing/` | Not derivable from events |
| Data pipelines | Billing only | `GET /api/billing/` | usage_key TODO(verify) |
| Error tracking exceptions | Yes | `GET /api/billing/`; fallback HogQL `event = '$exception'` (inference) | |
| Survey responses | Yes | `GET /api/billing/`; fallback HogQL `event = 'survey sent'` (inference) | |
| LLM analytics events | Billing only (fallback `$ai_*` events, inference) | `GET /api/billing/` | |
| Limit / free allocation | Yes | `products[].usage_limit`, `free_allocation`, `percentage_usage` | source-only field names |
| Period start/end | Yes | `billing_period.current_period_start/end` | |
| Time series | Yes | `GET /api/billing/usage/?start_date&end_date&interval` | `billing:read` |

## Open TODO(verify)

1. Live call on a no-card free org: confirm `products[].current_usage` and `usage_limit` are populated and list the exact `usage_key` values per product.
2. Calendar-month vs anniversary period anchor (not stated anywhere in docs searched: pricing, docs/billing, common-questions, limits-alerts).
3. Whether a project-scoped personal API key is accepted by `/api/billing/` or an org-scoped/unscoped key is required.
4. Session recordings REST endpoint params/count (page not readable); `uniq(session_id)` counting on `raw_session_replay_events`.
5. Size of the hourly read budget for free projects (docs do not state it).
