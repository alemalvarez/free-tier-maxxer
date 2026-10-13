# Feasibility spike — summary (verified_at 2026-10-11)

**Live checks run 2026-10-11 against real twoseats tokens: see live-checks.md. All five verdicts below are now confirmed.**

Per-provider detail with citations: github.md, posthog.md, langfuse.md, supabase.md, vercel.md.
All claims come from official docs only; anything not seen in docs is marked TODO(verify) in the provider file.

## Verdicts

| Provider | Verdict | Usage source | Period from API? | Limits from API? | Token / scope |
|---|---|---|---|---|---|
| GitHub | FEASIBLE (confirmed, fine-grained PAT works) | `GET /users/{u}/settings/billing/usage` (enhanced billing) | No, UTC calendar month | No, hardcode | Fine-grained PAT, user "Plan" read (docs contradict; verify live) |
| PostHog | FEASIBLE (confirmed) | `GET /api/billing/` → `usage_summary` | Yes, anniversary-anchored 30 days | Yes (`usage_limit`, `free_allocation`) | Personal API key, key holder must be org owner |
| Langfuse | PARTIAL (confirmed; root-obs proxy == v1 trace count) | `GET /api/public/v2/metrics` counts (obs + root-obs + scores) | No, signup-day anchor, unexposed | No, hardcode 50k units | Project pk/sk, no read-only keys exist; 100 req/day Hobby quota |
| Supabase | PARTIAL (confirmed; org endpoint needs organization_admin_read) | SQL via `POST /v1/projects/{ref}/database/query` + `GET /v1/projects` | No, org-creation-day anchor, unexposed | No, hardcode | Scoped PAT (GA 2026-10-06): projects_read, organization_admin_read, database_read |
| Vercel | PARTIAL (confirmed: charges endpoint 404s on Hobby) | `/v13/deployments/{id}` `duration.timeForBilling` only | No, Hobby "has no billing cycles" | No, hardcode | Team-scoped `vcp_` token |

## Metric coverage

| Provider | Obtainable | Unavailable (no documented route) |
|---|---|---|
| GitHub | Actions minutes, Packages storage/transfer, Codespaces | Copilot Free credit figure (unpublished) |
| PostHog | events, recordings, flag requests, pipelines, exceptions, surveys, LLM events, logs | — |
| Langfuse | observations, scores exact; traces approximated | billing-accurate trace count, billing anchor |
| Supabase | db_size, storage_size, MAU approx (last_sign_in_at), plan, project status/pause | egress, cached egress, realtime msgs, edge invocations |
| Vercel | all FOCUS service rows if Hobby returns them (unverified); build minutes + deploy counts via deployments API | allotments, reset window; Spend Management is Pro+ |

## Live checks
Done, see live-checks.md. Remaining TODO(verify): Supabase org endpoint with an org-read PAT; Langfuse and Supabase billing anchor days.

## Unofficial tier (browser session), verified 2026-10-11
| Provider | Route | Auth | Coverage | Doc |
|---|---|---|---|---|
| Vercel | SSR HTML of `vercel.com/<slug>/~/usage`, regex `meterData` per `batchKey` | session cookie (httpOnly) | all 49 meters incl. fast data transfer, edge requests, invocations, image transforms + billing cycle | unofficial-vercel.md |
| Supabase | `api.supabase.com/platform/organizations/{slug}/usage` + `/billing/subscription` + `/usage/daily` | session JWT (30 min, refreshable); `sbp_` PAT rejected | all 13 metrics incl. egress breakdown + real billing period | unofficial-supabase.md |

Alternative official routes were also researched and live-probed (alternative-routes.md): Vercel Observability metrics are 402 on Hobby, `vercel usage` CLI hits the same 404, Web Analytics pageviews work but are not comparable; Supabase edge-function invocations can be approximated from `function_edge_logs`.

Neither dashboard route accepts the read-only API token. Both need a persisted browser login (Playwright storageState) → opt-in experimental adapters.

## Daily history (pulled 2026-10-12, see checks/series-api.mjs, checks/out/*series*.json, concept/series.js)
| Provider | Route | Granularity | Depth observed | Notes |
|---|---|---|---|---|
| GitHub | raw `/users/{u}/settings/billing/usage` rows carry `date`, `sku`, `repositoryName` | day | current month | aggregate per sku/day |
| PostHog | HogQL `toDate(timestamp)` counts for events; `raw_session_replay_events` for recordings | day | whatever is in ClickHouse | `/api/billing/usage/` returned empty on free |
| Langfuse | `/api/public/v2/metrics` with `timeDimension.granularity=day` (`time_dimension`, `count_count`) | day | full | 3 calls/pull |
| Vercel | each SSR usage card has `initialData.data.data[]` with `date`, `sum`, per-project `resources` | day | 31 days (previous + current cycle) | storage meters are levels, not deltas; 93 rows had non-numeric sums (skipped) |
| Supabase | `/platform/organizations/{slug}/usage/daily?start&end` | day | 33 days returned; only metrics with non-zero usage appear; sizes absent | session JWT only |
| Supabase DB size | `/platform/projects/{ref}/infra-monitoring?attributes=pg_database_size&interval=1d` | hour or day | 31 days | session JWT; also disk_fs_*, network_*_bytes |

Charts in the concept are full from the first run; the tool's own snapshots only need to fill what providers don't keep.

## Design consequences

- `limits.yaml` is mandatory for 4/5 providers; PostHog's API limits can cross-check the YAML.
- Period anchor is per-provider config: GitHub = UTC calendar month; PostHog = from API; Langfuse and Supabase = `period_anchor_day` the user sets (from their signup date); Vercel = calendar month flagged as assumption.
- Readings need a `confidence` or `method` field: exact (PostHog, GitHub), approximate (Langfuse traces, Supabase MAU), unavailable (Supabase egress).
- Polling budget: Langfuse Hobby caps Metrics API at 100 req/day, so default snapshot cadence must be ≤ hourly with ≤ 4 calls.
- Vercel and Supabase egress are the candidates for the "unofficial / browser" adapter tier discussed in the brief review.
