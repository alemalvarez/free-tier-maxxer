# Supabase — unofficial route (verified 2026-10-11 in a logged-in browser)

## Summary
The Supabase dashboard reads org usage from an **undocumented platform API** on api.supabase.com that returns every
free-tier metric (including egress with per-service breakdown), the free allocation per metric, per-project allocations,
and the real billing period. It is complete and clean JSON. The catch: it only accepts the dashboard **session JWT**
(GoTrue access token, 30-minute expiry, issued by alt.supabase.io); a personal access token (`sbp_`) is rejected with
`401 Unsupported access token`. So this is a session-bound route, not a token route.

## Endpoints observed (all `GET`, header `Authorization: Bearer <session JWT>`, `Accept: application/json`)
| Path | What it returns |
|---|---|
| `/platform/organizations/{slug}/usage` | `{ usage_billing_enabled, usages[13] }`; each: `metric, usage (in free-unit scale), usage_original (raw), pricing_free_units, unit_price_desc, capped, unlimited, available_in_plan, cost, pricing_strategy, project_allocations[{ref,name,usage,hours}]` |
| `/platform/organizations/{slug}/billing/subscription` | `plan{id,name}, current_period_start, current_period_end, next_invoice_at (unix s), usage_billing_enabled, addons, project_addons, ...` |
| `/platform/organizations/{slug}/usage/daily?start&end` | per-day rows `{date, metric, usage, usage_original, breakdown}`; EGRESS breakdown: `egress_rest, egress_auth, egress_storage, egress_realtime, egress_function, egress_graphql, egress_supavisor, egress_logdrain` |
| `/platform/organizations/{slug}`, `/entitlements`, `/projects` | org meta, feature entitlements, project list |

Observed billing period: start 2026-10-10T00:00:00.000Z → end 2026-11-10T00:00:00.000Z (anniversary-anchored, matches the org creation day; NOT calendar month). This is the value the v1 Management API never exposes.

## Metrics returned (this org, 2026-10-11)
| metric | usage_original | usage (free-unit scale) | free units | desc | flags |
|---|---|---|---|---|---|
| EGRESS | 83141341 | 0.083141341 | 5 | 5 GB included | capped=true unlimited=false available=true |
| CACHED_EGRESS | 0 | 0 | 5 | 5 GB included | capped=true unlimited=false available=true |
| STORAGE_SIZE | 0 | 0 | 1 | 1 GB included | capped=true unlimited=false available=true |
| MONTHLY_ACTIVE_USERS | 1 | 1 | 50000 | 50,000 MAU included | capped=true unlimited=false available=true |
| MONTHLY_ACTIVE_THIRD_PARTY_USERS | 0 | 0 | 50000 | 50,000 MAU included | capped=true unlimited=false available=true |
| FUNCTION_INVOCATIONS | 0 | 0 | 500000 | 500,000 invocations included | capped=true unlimited=false available=true |
| LOG_INGESTION | 8434631 | 0.008434631 | 1 | 1 GB included | capped=true unlimited=false available=true |
| LOG_QUERYING | 1660036400 | 1.6600364 | 100 | 100 GB included | capped=true unlimited=false available=true |
| REALTIME_MESSAGE_COUNT | 0 | 0 | 2000000 | 2 Million messages included | capped=true unlimited=false available=true |
| REALTIME_PEAK_CONNECTIONS | 0 | 0 | 200 | 200 connections included | capped=true unlimited=false available=true |
| DATABASE_SIZE | 121592629 | 0.121592629 | 0.5 | 0.5 GB included | capped=true unlimited=false available=true |
| STORAGE_IMAGES_TRANSFORMED | 0 | 0 | undefined | N/A | capped=false unlimited=false available=false |
| MONTHLY_ACTIVE_SSO_USERS | 0 | 0 | undefined | N/A | capped=false unlimited=false available=false |

Scale: `usage` is already expressed in the unit of `pricing_free_units` (e.g. EGRESS 0.083 of 5 GB); `usage_original` is bytes / count.

## Auth attempts with the `sbp_` PAT
| Call | Status |
|---|---|
| `/platform/organizations/{slug}/usage` | 401 `Unsupported access token` |
| `/platform/organizations/{slug}/billing/subscription` | 401 `Unsupported access token` |
| `/platform/organizations/{slug}/usage/daily` | 401 `Unsupported access token` |
| `/v1/organizations/{slug}` (official) | 403 (token lacks org read; unrelated) |

## Database size history (verified 2026-10-12)
`GET /platform/projects/{ref}/infra-monitoring?attributes=<a,b,...>&interval=1m|1h|1d&startDate&endDate&databaseIdentifier={ref}` (session JWT).
- `pg_database_size` returns a daily (or hourly) series in bytes; 31 days observed on a Free project (103.9 MB → 121.7 MB). This is the quota metric's history.
- `disk_fs_used`, `disk_fs_size`, `disk_fs_used_wal`, `disk_fs_used_system`: filesystem view (2 GB provisioned disk on Free).
- Response shape differs: one attribute → `{data:[{period_start, <attr>}], total, totalAverage}`; several → `{data:[{period_start, values:{...}}], series:{...}, errors}`.
- Invalid attribute names return a 400 listing all 57 valid attributes (cpu, ram, network_receive/transmit_bytes, client connections, realtime, disk io, pg_database_size, disk_fs_*, replication lag).
- `network_transmit_bytes` is in the list → candidate egress approximation at the DB instance level (TODO(verify) against EGRESS from `/usage/daily`).
- The dashboard's Observability → Database page shows "Unable to load data for Disk Usage" on Free, yet the attributes answer; the gate is in the UI, not the API.

## How a session could be obtained (not implemented, options)
1. One-time Playwright login persisting `storageState` locally; the GoTrue refresh token in local storage lets the adapter mint new 30-min JWTs without re-login. Most robust, heaviest dependency.
2. User pastes the access token from devtools: works for 30 minutes only → useless for cron.
3. Supabase CLI login (`supabase login`) stores an `sbp_` PAT, not a session → does not help.
TODO(verify): whether the GoTrue refresh endpoint used by the dashboard (`https://alt.supabase.io/auth/v1/token?grant_type=refresh_token`, inferred from the JWT issuer) is callable outside the browser, and whether refresh tokens rotate.

## Verdict
UNOFFICIAL ROUTE, session-bound. Complete coverage of Free limits: egress, cached egress, storage size, MAU (incl. third-party and SSO), function invocations, realtime messages and peak connections, database size, log ingestion and querying. Note DATABASE_SIZE here (121.6 MB) is larger than pg_database_size via SQL (106.3 MB); the dashboard figure is the one the quota uses. Official route stays: SQL via Management API for db_size / storage / MAU-approx, `unavailable` for the rest. Ship the platform-API adapter as opt-in `supabase-dashboard`, `experimental: true`, requiring a persisted browser session.
