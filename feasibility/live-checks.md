# Live checks — results (run 2026-10-11 against the twoseats accounts)

Scripts: `checks/*.mjs`, run with `node --env-file=.env checks/<provider>.mjs`. Raw (secret-scrubbed) responses in `checks/out/`.
These settle the TODO(verify) items that docs could not. Everything here is observed, not read from docs.

## GitHub — CONFIRMED FEASIBLE
- Fine-grained PAT with only user "Plan: read" → 200 on both `/users/{u}/settings/billing/usage` and `/usage/summary`. The tutorial page claiming fine-grained PATs are unsupported is wrong.
- Use `/usage/summary?year&month`: one row per SKU, already aggregated. Fields: `product, sku, grossQuantity, discountQuantity, netQuantity, grossAmount, discountAmount, netAmount, pricePerUnit, unitType`.
- Observed SKUs: `actions_linux` (unitType `minutes`, 362 this month, all discounted → within free allowance), `actions_storage` (unitType `gigabyte-hours`). No Packages/Codespaces rows appear when unused, so adapter must treat a missing SKU as 0, not unavailable.
- Included allowance shows as `discountQuantity == grossQuantity`, `netQuantity 0`. Free limit (2,000 min) is not returned; comes from limits.yaml.
- Raw `/usage` returns per-day, per-repo rows (`repositoryName`) — useful for history, not needed for v1.

## PostHog — CONFIRMED FEASIBLE (best provider)
- `GET /api/billing/` on a no-card free org → 200. `subscription_level: "free"`, `has_active_subscription: false`.
- `billing_period.current_period_start/end` present (observed start 2026-10-11T11:47Z, end 2026-11-10 → anniversary-anchored 30-day cycle, NOT calendar month).
- `usage_summary` is the cleanest source: `{ <usage_key>: { usage, limit, todays_usage? } }`. Observed keys: events 1,000,000; recordings 5,000; mobile_recordings 2,500; feature_flag_requests 1,000,000; survey_responses 1,500; rows_synced 1,000,000; rows_exported 1,000,000; cdp_trigger_events 10,000; exceptions 100,000; llm_events 100,000; logs_mb_ingested 10,000; ai_credits 500; replay_vision_credits 2,500; signals_credits 4,500; workflow_emails 10,000; workflow_destinations 10,000; historical_rows_synced 100,000,000; `limit: null` for enhanced_persons_events and log retention keys.
- `products[]` duplicates it with `type, usage_key, current_usage, usage_limit, free_allocation, percentage_usage, unit`. Two products have `usage_key: null` (integrations, platform_and_support) — skip them.
- `usage` resets at period start while `todays_usage` keeps counting; use `usage` (+ optionally `todays_usage`) for the reading.
- `/api/billing/usage/` time series returned empty `results` on free; not needed.
- HogQL fallback works (`query:read`): count since cycle start returned 10 events.

## Langfuse — CONFIRMED PARTIAL, proxy is exact
- v2 Metrics API with project pk/sk → 200. This month: observations 4,995; root observations 647; scores-numeric 3,224; scores-categorical 0.
- **Root-observation filter matched legacy v1 `traces` view exactly (647 = 647)**, so the trace proxy is reliable for this project. Units used ≈ 647 + 4,995 + 3,224 = 8,866 of 50,000 (calendar-month window; real anchor unknown).
- v1 metrics still served; response carries a `_deprecation` notice (removal 2026-11-16). Do not depend on it.
- Billing anchor still unexposed → user config `billing_anchor_day` (left empty for now).
- Rate-limit headers were not captured; 5 calls/run fits the 100/day Hobby budget at ≤ 20 runs/day. Adapter should do 3 calls (observations, root, scores-numeric) + optional categorical/boolean.

## Supabase — CONFIRMED PARTIAL
- `GET /v1/projects` → 200: `ref, name, status (ACTIVE_HEALTHY), region, created_at`.
- `POST /v1/projects/{ref}/database/query` with `read_only: true` → 201. Also `/database/query/read-only` → 201 (needs schema-qualified names). Both work on a Free org with a scoped PAT.
- Observed: db_size 106,318,995 bytes (~101 MB of 500 MB); storage.objects 0; MAU approximation (last_sign_in_at this month) 2.
- `GET /v1/organizations/{slug}` → **403 Forbidden**: the current PAT lacks `organization_admin_read` (or is project-scoped). Plan detection is optional; config `plan: free` covers it. TODO(verify): regenerate with org read to confirm the endpoint works on Free.
- `usage.api-counts?interval=1day` → 200 with per-service request counts; not a quota metric, but could feed an "activity → pause risk" heuristic.
- Egress, cached egress, realtime, edge invocations: still no route. Mark `unavailable`.

## Vercel — CONFIRMED: no usage API on Hobby
- A **project-scoped** token: `/v2/user` 404 "User not found", `/v2/teams` 403, `/v9/projects` 403 `invalidToken` (first run, before token regeneration). A **team-scoped** token: `/v2/user` 200, `/v2/teams` 200, `/v9/projects` 200.
- Contrary to the docs, the team-scoped token still needed `?teamId=` on `/v9/projects` and `/v6/deployments` in the first probe; `/v5/user/tokens/current` returns `token.scopes[].teamId`, so the adapter can resolve teamId itself.
- `GET /v2/teams/{id}` → `billing.plan: "hobby"`, `billing.period: null`, `billing.planIteration: "legacy"`, `softBlock: null` → plan detection and overage-block detection work.
- **`GET /v1/billing/charges` → 404 `{"code":"costs_not_found","message":"Costs not found"}`** both with and without `teamId`, with ISO and date-only ranges. Hobby has no cost records → the only official usage endpoint is unusable on Hobby. This is the verified gap.
- Fallback works: `/v6/deployments` lists deployments; `/v13/deployments/{id}` returns `duration.timeForBilling` (60,000 ms observed, i.e. billed in 1-min increments) and `cpuTimeForBilling`. Build minutes are derivable by summing over deployments in the window. Bandwidth, edge requests, function invocations: unavailable without the dashboard's internal API or browser automation.

## Adapter implications
| Provider | Primary call(s) per snapshot | Period source | Limits source |
|---|---|---|---|
| GitHub | 1 (`/usage/summary`) | UTC calendar month (assumption, docs) | limits.yaml |
| PostHog | 1 (`/api/billing/`) | API `billing_period` | API `usage_summary.limit` (yaml as cross-check) |
| Langfuse | 3–5 (`/v2/metrics`) | config `billing_anchor_day` | limits.yaml |
| Supabase | 1 + 3 SQL | config `billing_anchor_day` | limits.yaml |
| Vercel | 1 team + N deployments | calendar month (assumption) | limits.yaml |
