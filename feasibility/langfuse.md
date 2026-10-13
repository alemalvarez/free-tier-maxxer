# Langfuse Cloud (Hobby plan) — API feasibility spike

**Verdict: PARTIAL.** There is no official API that returns "units used this billing period vs plan limit"; the limit (50k) must be hardcoded and usage must be reconstructed from the project-scoped Metrics API v2 (observations + root-observation count as a trace proxy + score counts). The billing-cycle anchor (signup day-of-month, not calendar month) is not exposed by any public endpoint, and the Hobby Metrics-API quota (100 req/day, fixed window) makes hourly polling tight (4 calls/poll x 24 = 96/day).

verified_at: 2026-10-11

## 1. Billable unit
- Definition: `Units = Count of Traces + Count of Observations + Count of Scores`. "Any trace, observation, or score stored in Langfuse counts as a billable unit, whether it is sent by your application or created by Langfuse features such as LLM-as-a-Judge, Annotation Queues, or experiments." — https://langfuse.com/docs/administration/billable-units
- Pricing FAQ: "A billable unit is any tracing data point you send to Langfuse -- including the trace, observations (spans, events, generations), and scores (evaluations)." — https://langfuse.com/pricing (confirmed via WebFetch)
- Backend confirmation: free-tier threshold job sums `traces + observations + scores` per org per billing cycle (`counts.total = counts.traces + counts.observations + counts.scores`) — https://github.com/langfuse/langfuse/blob/main/worker/src/ee/usageThresholds/usageAggregation.ts

## 2. Official usage-vs-limit endpoint
- **None.** Project-level public API spec (https://cloud.langfuse.com/generated/api/openapi.yml) has no `usage`/`billing` path; the only "Usage" schemas are LLM token usage. Org-level spec (https://cloud.langfuse.com/generated/organizations-api/openapi.yml) only has `/api/admin/organizations*` (self-hosted admin) and membership/project/apiKey routes — https://langfuse.com/docs/administration/scim-and-org-api
- Docs say usage is visible only in-app: "Use the Usage Monitoring Report in the Dashboards tab ... For organization-wide usage, use the spend alerts" — https://langfuse.com/docs/administration/billable-units. Spend alerts are Core+ only — https://langfuse.com/docs/administration/spend-alerts
- The org usage breakdown in the UI is an internal tRPC route (`organizationUsageRouter.breakdown`, `protectedOrganizationProcedure`), not public REST — https://github.com/langfuse/langfuse/blob/main/web/src/features/organization-usage/server/organizationUsageRouter.ts

## 3. Fallback: Metrics API
- Current endpoint: `GET /api/public/v2/metrics?query=<url-encoded JSON>`; Basic auth; views `observations`, `scores-numeric`, `scores-categorical`, `scores-boolean`; **`traces` view removed in v2**; query fields `view, dimensions[], metrics[{measure,aggregation}], filters[], timeDimension, fromTimestamp (required), toTimestamp (required), orderBy, config.row_limit (<=1000)`. Measure `count` + aggregation `count` returns `count_count`. — https://langfuse.com/docs/metrics/features/metrics-api and OpenAPI `/api/public/v2/metrics` description
- Trace-count proxy: filter `{"column":"isRootObservation","operator":"=","value":true,"type":"boolean"}` ("count semantic roots"). Caveat from docs: assumes one exported app root per trace; traces whose root lives in another service are missed. — https://langfuse.com/docs/api-and-data-platform/features/public-api#logical-root-observations
- Example "observations since cycle start":
  `{"view":"observations","metrics":[{"measure":"count","aggregation":"count"}],"filters":[],"fromTimestamp":"<cycleStart>","toTimestamp":"<now>"}`
- Legacy `GET /api/public/metrics` (v1): same query shape but **has `view: "traces"`** (exact trace count). Deprecated; Langfuse Cloud serves it until **2026-11-16**. — https://langfuse.com/faq/all/deprecated-api-migration#metrics-v1
- Legacy `GET /api/public/metrics/daily`: returns per-day `countTraces`, `countObservations`, `totalCost` (no scores); params `traceName,userId,tags,fromTimestamp,toTimestamp,page,limit`. Deprecated, replacement is v2 with `timeDimension.granularity=day`; no longer present in the current OpenAPI spec. — https://langfuse.com/faq/all/deprecated-api-migration#daily-metrics
- Match with billing: billing counts traces/observations/scores from ClickHouse per project per day over the billing cycle (`getTraceCountsByProjectAndDay` etc., usageAggregation.ts above). Metrics v2 counts observations and scores by the same entity, but traces only via the root proxy; billing is org-wide across all projects while a project key sees one project. Non-v2 endpoints can lag ~10 min; v2 is real-time only with SDKs sending `x-langfuse-ingestion-version: 4` (older SDKs: up to 15 min delay). — https://langfuse.com/docs/metrics/features/metrics-api

## 4. Authentication
- Project API keys `pk-lf-…/sk-lf-…`, HTTP Basic (`curl -u public-key:secret-key`), scoped to one project, not tied to a user; created in Project Settings -> API Keys (needs Owner/Admin). — https://langfuse.com/docs/administration/rbac#api-keys, https://langfuse.com/docs/api-and-data-platform/features/public-api
- Org-scoped keys exist but only for the Organization Management API (projects/memberships/apiKeys/SCIM) and are **Enterprise-only** on Cloud (Hobby: Not Available). — https://langfuse.com/docs/administration/scim-and-org-api
- No read-only / scoped project keys. Maintainer (2025-10-17): "currently there are two access levels": pk only = ingest scores; pk+sk = full read/write. — https://github.com/orgs/langfuse/discussions/7104. Metrics requires pk+sk.

## 5. Billing period
- Pricing FAQ (paid plans): "You get one bill each month. The plan fee is charged at the start of the month, and usage is charged at the end of the month." — https://langfuse.com/pricing
- Free-tier enforcement code: cycle start = most recent occurrence of the anchor day-of-month, anchor = `cloudBillingCycleAnchor` else org `createdAt` (UTC day), i.e. **signup anniversary, not calendar month**; `getBillingCycleEnd` = "when the usage limit resets". — https://github.com/langfuse/langfuse/blob/main/packages/shared/src/server/utils/billingCycleHelpers.ts
- No public API field returns the anchor or cycle start. `GET /api/public/projects` returns only project id/name + org id/name. TODO(verify): whether the org creation date is retrievable anywhere via public API (looked in both OpenAPI specs; nothing).

## 6. Hobby limits and Core price
See table below. Source: https://langfuse.com/pricing (verified_at 2026-10-11). Enforcement thresholds from code: emails at 50k/100k/200k, **ingestion blocked at 250k** (when `LANGFUSE_FREE_TIER_USAGE_THRESHOLD_ENFORCEMENT_ENABLED=true`) — https://github.com/langfuse/langfuse/blob/main/worker/src/ee/usageThresholds/constants.ts and thresholdProcessing.ts.

## 7. Region hosts
EU `https://cloud.langfuse.com` (Ireland, eu-west-1); US `https://us.cloud.langfuse.com` (Oregon, us-west-2); Japan `https://jp.cloud.langfuse.com`; HIPAA `https://hipaa.cloud.langfuse.com` (Enterprise only per pricing "Data region" row). API base = host + `/api/public`. Accounts are fully separated per region. — https://langfuse.com/security/data-regions, https://langfuse.com/pricing

## 8. Rate limits (per organization, fixed windows)
"Limits apply to an organization and resource bucket." "Rate-limit windows are fixed: the first request to a bucket starts its window ... neither rolling nor aligned to UTC calendar hours or days." 429 + `Retry-After`. — https://langfuse.com/faq/all/api-limits
Hobby: Metrics API v2 **100 req/day**; Legacy Metrics **100 req/day**; General API (incl. Observations v2, `/projects`) 30 req/min; Deprecated read APIs 15 req/min; Tracing 1,000 req/min. Core: Metrics v2 100 req/hour; Legacy 2,000 req/day; General 100 req/min.
Hourly polling budget on Hobby: 4 metrics calls/poll (observations all, observations root-only, scores-numeric, scores-categorical; scores-boolean is included in scores-numeric per OpenAPI) x 24 = 96/day. Fits, but shares the bucket with any other Metrics-API use in the org; prefer 2-3 h cadence or a single daily-granularity query cached locally.

## Metric obtainability

| Metric | Obtainable via API? | Endpoint | Notes |
|---|---|---|---|
| Units used this cycle (official) | No | — | Only in UI (Usage Monitoring dashboard / org Billing tab); tRPC internal |
| Plan limit (50k) | No | — | Hardcode from pricing page |
| Billing cycle start/reset date | No | — | Anchor = signup day (code); not exposed; TODO(verify) |
| Observation count since date | Yes | `GET /api/public/v2/metrics` view=observations, measure=count | Real-time with new SDKs |
| Trace count since date | Approx. | v2 metrics + `isRootObservation=true` filter; exact via legacy `GET /api/public/metrics` view=traces until 2026-11-16 | Root proxy may undercount |
| Score count since date | Yes | v2 metrics views scores-numeric (+boolean), scores-categorical | 2 calls |
| Per-day breakdown | Yes | v2 metrics `timeDimension.granularity=day` | replaces `/metrics/daily` |
| Org-wide usage (multi-project) | Per project only | one key per project | 1 project here, OK |
| Plan name / tier | No | — | not in public API |

## Free-tier limits (Hobby) — source https://langfuse.com/pricing, verified_at 2026-10-11

| Item | Hobby | Core (next tier) |
|---|---|---|
| Price | Free, no card | $29/month |
| Units included | 50k / month | 100k / month, then $8 / 100k |
| Data access | 30 days | 90 days |
| Users | 2 | Unlimited |
| Projects | Unlimited | Unlimited |
| Annotation queues / Alerts | 1 / 2 | 3 / 20 |
| Ingestion throughput | 1,000 req/min | 4,000 req/min |
| General API | 30 req/min | 100 req/min |
| Metrics API v2 | 100 req/day | 100 req/hour |
| Legacy Metrics API | 100 req/day | 2,000 req/day |
| Spend alerts / data retention mgmt | Not available | Spend alerts yes; retention mgmt Pro+ |
| Regions | US, EU, Japan | US, EU, Japan |
| Hard block (code) | ingestion blocked at 250k units/cycle | n/a |

## Open TODO(verify)
- Billing anchor for Hobby orgs: code uses `cloudBillingCycleAnchor ?? org.createdAt`; confirm on a real Hobby org whether the UI "resets on" date equals signup day-of-month (no doc statement found; pricing FAQ only describes paid monthly billing).
- Whether `LANGFUSE_FREE_TIER_USAGE_THRESHOLD_ENFORCEMENT_ENABLED` is on in Cloud (blocking at 250k). Looked in docs/pricing; not documented.
- Exact agreement between v2 `isRootObservation=true` count and the billing trace count for a typical single-service SDK setup; test empirically against the Usage Monitoring dashboard.
- Scores: confirm `scores-numeric` view includes BOOLEAN rows (OpenAPI says "numeric and boolean score data"; docs list a separate `scores-boolean` view) to avoid double counting.
- "Ingestion" API-key role mentioned in PR #17952 (discussion 7104, 2026-10-06): not documented; treat read-only keys as unavailable.
