# Supabase — free-tier usage feasibility

**Verdict: PARTIAL on Free.** The Management API exposes no org/project usage-vs-quota endpoint (egress, storage size, MAU, realtime, edge invocations are dashboard-only), and nothing reports the billing period. DB size, storage size and an MAU approximation are obtainable via SQL through `POST /v1/projects/{ref}/database/query` with a scoped read-only PAT; project status/pausing and plan are obtainable via `GET /v1/projects` and `GET /v1/organizations/{slug}`.

verified_at: 2026-10-11

## 1. Management API usage endpoints

Checked the full OpenAPI spec (`https://api.supabase.com/api/v1-json`, downloaded 2026-10-11, 350 KB) and the reference index (https://supabase.com/docs/reference/api/introduction).

- Paths matching `usage|billing|organizations|entitlements` in the spec: `/v1/organizations`, `/v1/organizations/{slug}`, `/v1/organizations/{slug}/entitlements`, `/members`, `/projects`, `/project-claim/{token}`, `/v1/projects/{ref}/analytics/endpoints/usage.api-counts`, `.../usage.api-requests-count`, `/v1/projects/{ref}/billing/addons[/{addon_variant}]`.
- **No `GET /v1/organizations/{slug}/usage`, no `/v1/projects/{ref}/usage`, no endpoint returning egress, cached egress, DB size, storage size, MAU, realtime messages or edge-function invocations.** A grep of the spec for `billing_period|billing cycle|current_period|period_start|egress|disk_size|db_size|monthly_active` returned nothing.
- What does exist:
  - `GET /v1/projects/{ref}/analytics/endpoints/usage.api-counts?interval=15min|30min|1hr|3hr|1day|3day|7day` → `result[]: {timestamp, total_auth_requests, total_realtime_requests, total_rest_requests, total_storage_requests}`, `error`. Permission `analytics_usage_read`. Not a billed metric. https://supabase.com/docs/reference/api/v1-get-project-usage-api-count
  - `GET /v1/projects/{ref}/analytics/endpoints/usage.api-requests-count` → `result[]: {count}`. No time window documented. https://supabase.com/docs/reference/api/v1-get-project-usage-request-count
  - `GET /v1/organizations/{slug}` → `{id, name, plan, opt_in_tags, allowed_release_channels}`; `plan` enum in spec: `free|pro|team|enterprise|platform`. Permission `organization_admin_read` / OAuth `organizations:read`. https://supabase.com/docs/reference/api/v1-get-an-organization
  - `GET /v1/organizations/{slug}/entitlements` → `entitlements[]: {feature{key,type}, hasAccess, type, config}` — feature flags, no quotas/usage. https://supabase.com/docs/reference/api/v1-get-organization-entitlements
  - `GET /v1/projects/{ref}/billing/addons` — add-ons only (compute etc.), not usage.

## 2. Does it work on the Free plan?

The spec gates endpoints with `x-allowed-plans` (vanity subdomain, read replicas → Pro/Team/Enterprise) and marks the `jwt-bearer` OAuth grant as Team/Enterprise only. None of the endpoints used here (`/v1/projects`, `/v1/organizations/{slug}`, `/database/query`, `usage.api-counts`, `/health`) carry `x-allowed-plans` in the spec. Source: spec download above. `TODO(verify)` empirically with a Free-org PAT.

## 3. Authentication

- Bearer PAT from `https://supabase.com/dashboard/account/tokens`. Two kinds: **classic** ("Legacy", "same privileges as your user account") and **scoped** ("can only reach the organizations, projects, and permissions you choose"). https://supabase.com/docs/reference/api/introduction
- Scoped PATs GA for everyone since 2026-10-06; per-capability **read or read-write**; scope to "selected projects in one organization, or all projects in selected organizations"; expiry up to one year; "SQL runs read-only unless the token has Database read-write". https://supabase.com/changelog/scoped-personal-access-tokens-ga ; https://supabase.com/docs/guides/platform/personal-access-tokens
- Read-only token for this tool: `projects_read`, `organization_admin_read`, `database_read`, `analytics_usage_read` (permission identifiers as they appear in the spec and endpoint docs).
- OAuth alternative: register an OAuth app under org settings; scopes are Read/Write per area (Organizations, Projects, Database, Storage...). Database **Write** is required to "Run SQL queries" via OAuth. https://supabase.com/docs/guides/integrations/build-a-supabase-integration ; https://supabase.com/docs/guides/integrations/build-a-supabase-oauth-integration/oauth-scopes

## 4. Fallback routes per metric

- **DB size.** `POST /v1/projects/{ref}/database/query` body `{query, parameters?, read_only?}` (Beta/experimental; fine-grained `database_read` or `database_write`; OAuth `database:write`). Also `POST /v1/projects/{ref}/database/query/read-only` "Run a sql query as supabase_read_only_user" (spec; all refs must be schema-qualified). Official size query: `select pg_size_pretty(sum(pg_database_size(pg_database.datname))) from pg_database;`. Free projects enter read-only mode above 500 MB. https://supabase.com/docs/reference/api/v1-run-a-query ; https://supabase.com/docs/guides/platform/database-size
- **Storage size.** Official docs give SQL on `storage.objects` summing `(metadata->>'size')::bigint` per bucket; billed figure is the GB-hour average over the cycle, so live size is an approximation. Storage API `list()` returns `metadata` (null for folders), default `limit` 100 — usable but slower. https://supabase.com/docs/guides/platform/manage-your-usage/storage-size ; https://supabase.com/docs/reference/javascript/storage-from-list
- **MAU.** Official definition: "distinct users who sign in or refresh their token during the billing cycle", counted once per cycle, reset at cycle start. https://supabase.com/docs/guides/platform/manage-your-usage/monthly-active-users . Approximation: `select count(*) from auth.users where last_sign_in_at >= <cycle_start>` — column `last_sign_in_at timestamptz NULL` is defined in the official auth schema https://raw.githubusercontent.com/supabase/auth/master/migrations/00_init_auth_schema.up.sql . Undercounts token-refresh-only users (not reflected in that column — inferred, `TODO(verify)`).
- **Egress / cached egress.** No documented API or SQL route; dashboard only ("API Gateway logs ... do not include response byte data"). https://supabase.com/docs/guides/platform/manage-your-usage/egress
- **Realtime messages / Edge invocations.** Dashboard only; no API/SQL route documented. https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages ; https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations
- **Project status / pausing.** `GET /v1/projects` (`projects_read`) → `{id, ref, organization_id, organization_slug, name, region, created_at, status, database{...}}`. `status` enum (spec): `INACTIVE, ACTIVE_HEALTHY, ACTIVE_UNHEALTHY, COMING_UP, UNKNOWN, GOING_DOWN, INIT_FAILED, REMOVED, RESTORING, UPGRADING, PAUSING, RESTORE_FAILED, RESTARTING, PAUSE_FAILED, RESIZING`. https://supabase.com/docs/reference/api/v1-list-all-projects . Pause rule: "pauses Free Plan projects that show low activity over a 7-day period"; pricing: "Free projects are paused after 1 week of inactivity"; "Paid projects cannot be paused". https://supabase.com/docs/guides/platform/free-project-pausing ; https://supabase.com/pricing . Also `GET /v1/projects/{ref}/health?services=db,auth,...` (spec).

## 5. Billing period

No endpoint returns it (spec grep above). Rule: "A billing cycle starts with the creation of a Supabase organization", resets monthly on the anchored day (last day of month if absent). The page describes paid plans; it does not explicitly say Free orgs follow the same anchor, but the MAU and Realtime docs state Free quotas are "per billing cycle". https://supabase.com/docs/guides/platform/your-monthly-invoice ; https://supabase.com/docs/guides/platform/billing-on-supabase ("Each organization has its own subscription ... billing cycle"). Workaround: derive cycle start from the org creation day — `TODO(verify)` whether `created_at` is exposed for orgs (not in the `/v1/organizations` schema; `/v1/projects.created_at` is).

## 6. Metric table

| Metric | Obtainable via API on Free? | Route | Notes |
|---|---|---|---|
| DB size | Yes (approx of quota metric) | SQL via Mgmt API `/database/query` | `pg_database_size`; quota = 500 MB → read-only mode |
| Storage size | Yes (live, not GB-hr avg) | SQL on `storage.objects` / Storage API | billed as avg over cycle |
| MAU | Approx only | SQL on `auth.users.last_sign_in_at` | misses refresh-only users; needs cycle start |
| Egress | No | none | dashboard only |
| Cached egress | No | none | dashboard only |
| Realtime messages | No | none | dashboard only |
| Edge invocations | No | none | dashboard only |
| API request counts | Yes (not a quota) | Mgmt API `usage.api-counts` | 7-day max interval; 30 req/min |
| Project status / paused | Yes | Mgmt API `GET /v1/projects` | `INACTIVE` = paused |
| Plan | Yes | Mgmt API `GET /v1/organizations/{slug}` | `plan: free` |
| Billing period | No | none | derive from org creation day |

## 7. Free-tier limits (source: https://supabase.com/pricing, verified_at 2026-10-11)

| Limit | Value |
|---|---|
| Database size | 500 MB (Shared CPU, 500 MB RAM) |
| Egress | 5 GB |
| Cached egress | 5 GB |
| File storage | 1 GB |
| MAU | 50,000 |
| Active projects | "Limit of 2 active projects" |
| Realtime messages | 2 Million / month |
| Realtime peak connections | 200 |
| Edge Function invocations | 500,000 |
| Pause rule | "Free projects are paused after 1 week of inactivity" (docs: 7-day low-activity period) |
| Total project count | `TODO(verify)` — pricing only states the active-project limit |

## 8. Rate limits (https://supabase.com/docs/reference/api/introduction)

120 req/min per user, per project or organization, per endpoint; 429 for the rest of the minute. Headers `X-RateLimit-Limit/Remaining/Reset`. Exceptions: `usage.api-counts` and `usage.api-requests-count` 30 req/min. PAT limits are per user (all tokens share). Hourly polling of ~6 endpoints across 2 projects is far below limits.

## Open TODO(verify)

- Empirically confirm `/database/query` and `usage.api-counts` return 200 (not 402/403) with a scoped read-only PAT on a Free org.
- Whether `read_only: true` / `database_read` suffices for `/database/query` (changelog says SQL is read-only unless read-write; doc lists `database_read` OR `database_write`).
- Whether token refresh updates `auth.users.last_sign_in_at` (searched supabase.com docs; no page documents column semantics).
- Billing-cycle anchor for Free orgs and whether org `created_at` is retrievable via API.
- Total (incl. paused) project cap on Free; restore window after pause (docs page says 1 year in body, "90-day" in heading anchor).
- Whether `usage.api-requests-count` covers a fixed window (undocumented).
