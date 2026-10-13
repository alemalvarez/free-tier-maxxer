# Vercel (Hobby plan) — usage API feasibility

**Verdict: PARTIAL on Hobby.** Vercel has exactly one official usage endpoint, `GET /v1/billing/charges` (FOCUS v1.3 JSONL, daily rows with `ConsumedQuantity`/`ConsumedUnit` per `ServiceName`), and the docs put no plan restriction on it — but nothing in the docs confirms it returns rows for a $0 Hobby team, and no endpoint returns the Hobby allotments or a billing-period window, so limits must be hard-coded and the window computed client-side. Everything below is from vercel.com docs read on 2026-10-11.

## 1. Usage endpoints in the REST API
- REST index groups (https://vercel.com/docs/rest-api, last_updated 2026-10-11): there is **no "Usage" group**. "Billing" group has 3 endpoints: `GET /v1/billing/charges` (List FOCUS billing charges), `GET /v1/billing/contract-commitments`, `POST /v1/billing/buy`. "Teams" has no usage endpoint. "Observability" only manages Observability Plus project toggles. "Web Analytics" exposes `/v1/query/web-analytics/{visits,events}/{aggregate,count}` (page-view data, not plan usage). Marketplace `/v1/installations/{id}/billing*` is for integration partners submitting data, not reading your own.
- **`GET /v1/billing/charges`** (https://vercel.com/docs/rest-api/billing/list-focus-billing-charges, last_updated 2026-10-11): "Returns the billing charge data in FOCUS v1.3 JSONL format for a specified Vercel team, within a date range specified by `from` and `to` query parameters. Supports 1-day granularity with a maximum date range of 1 year." Query: `from` (required, ISO 8601 UTC, inclusive), `to` (required, exclusive), `teamId`/`slug` (optional). `Content-Type: application/jsonl`, optional gzip via `Accept-Encoding: gzip`. Roles: "Owner, Member, Developer, Security, Billing, and Enterprise Viewer".
- Response fields (required): `BilledCost`, `BillingCurrency` (USD), `ChargeCategory` (Adjustment|Credit|Purchase|Tax|Usage), `ChargePeriodStart`/`ChargePeriodEnd`, `ConsumedQuantity` (nullable number: "Volume of resource consumed"), `ConsumedUnit` (nullable), `EffectiveCost`, `PricingCategory`, `PricingCurrency`, `PricingQuantity`, `PricingUnit`, `ServiceName` ("Display name for the service/product"), `ServiceProviderName`, `SkuId` ("Stable identifier for the charged product or item"), `Tags` ("Charge metadata including the Vercel ProjectId and ProjectName"). Optional: `RegionId`, `RegionName`, `ServiceCategory`.
- Announced in changelog 2026-02-19 (https://vercel.com/changelog/access-billing-usage-cost-data-api). CLI wrapper `vercel usage` (https://vercel.com/docs/cli/usage): `--since/--until`, `--breakdown daily|weekly|monthly`, `--format json` (JSON has `period`, `context`, `services[]`, `totals`, `chargeCount`). Omitting both time options "query[s] the current billing period".
- The dashboard Usage page (https://vercel.com/docs/pricing/manage-and-optimize-usage) is documented UI-only; its backing endpoints are not in the REST reference → treat as unofficial. The docs mention no other API.
- Deployment objects expose build timing: `GET /v13/deployments/{idOrUrl}` (https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url) has `duration.timeForBilling` ("Billable build-container duration in milliseconds, capped at 45 minutes, rounded up to a whole minute, with a one-minute minimum"), `duration.startTime`, `duration.endTime`, `duration.timeToContainerExit`, plus `resourceConfig.buildMachine`. Changelog 2026-09-21 confirms exposure in REST API (https://vercel.com/changelog/deployments-now-show-billable-duration-and-cpu-minutes).

## 2. Does it work on Hobby?
- The `/v1/billing/charges` reference, the changelog, and the `vercel usage` CLI page contain **no plan restriction and no mention of Hobby**. The only gate stated is the role list (Hobby page says RBAC is "N/A" on Hobby: https://vercel.com/docs/plans/hobby).
- Plans docs state usage is visible to Hobby on the dashboard: "Where do I understand my usage? On the usage page of your dashboard" (https://vercel.com/docs/plans). Hobby "get[s] a monthly allotment of each billable resource" (https://vercel.com/docs/limits).
- `TODO(verify)`: whether `/v1/billing/charges` returns `ChargeCategory: "Usage"` rows with non-null `ConsumedQuantity` for a Hobby team (where cost is $0), or returns an empty stream / 403. Needs a live call with a Hobby token. Not stated anywhere in docs.

## 3. Authentication
- Bearer token in `Authorization` header (https://vercel.com/docs/accounts/access-tokens, last_updated 2026-09-08). Created at vercel.com/account/tokens, value shown once, prefix `vcp_`, chosen expiration.
- Three scopes: **Full Account** ("Acts on your personal account and every team you belong to"), **Team** ("Limited to a single team... across all of its projects"), **Project** (one project; "denies any request to another project, to a user-level resource, or to a team-level resource").
- Minimum for this tool: a **Team-scoped** token for the Hobby team (billing charges are team-level, so Project scope is denied). "Team- and project-scoped tokens do not require the `teamId` query parameter... Full-account tokens still need `?teamId=`" (same page). Team ID via `GET /v2/teams` or `GET /v2/user` (`defaultTeamId`).
- `GET /v2/teams/{teamId}` returns `billing.plan` enum `hobby|pro|enterprise` — usable to detect plan (https://vercel.com/docs/rest-api/teams/get-a-team).

## 4. Billing period
- `/v1/billing/charges` has **no billing-period field**; only per-charge `ChargePeriodStart`/`ChargePeriodEnd` (daily rows). Caller supplies `from`/`to`.
- Hobby cycle: "As the Hobby plan is a free tier there are no billing cycles. In most cases, if you exceed your usage limits on the Hobby plan, you will have to wait until 30 days have passed before you can use the feature again." (https://vercel.com/docs/plans/hobby, last_updated 2026-09-14). Pricing page says "/ month included". `GET /v2/teams/{teamId}` and `GET /v2/user` document no period start/end field (`user.billing` is an untyped object).
- `TODO(verify)`: what `vercel usage` treats as "current billing period" on Hobby (calendar month? trailing 30 days?). Docs don't say. Practical default for the tool: calendar month UTC, labelled as an assumption.

## 5. Hobby limits (see table below)
Sources: https://vercel.com/pricing, https://vercel.com/docs/plans/hobby, https://vercel.com/docs/limits (last_updated 2026-09-16), https://vercel.com/docs/limits/fair-use-guidelines. Non-commercial caveat: "Hobby teams are restricted to non-commercial personal use only. All commercial usage of the platform requires either a Pro or Enterprise plan" (fair-use page); pricing FAQ: "If you have a free Hobby account, you are limited to the usage caps and cannot purchase additional usage."
- Note: there is **no "Edge Requests" metric any more**; pricing lists "CDN Requests: 1M / month". "Function duration" is split into Active CPU (4 CPU-hrs) + Provisioned Memory (360 GB-hrs). No "build execution minutes" allotment is listed for Hobby ("Basic is included with Hobby", https://vercel.com/docs/builds/managing-builds); the only build limits are 45 min/deployment and 1 concurrent build.

## 6. Fallbacks
- Build minutes: sum `duration.timeForBilling` over `GET /v7/deployments?since=&until=` (list has `buildingAt`/`ready`; per-deployment detail has `duration.*`). Official, works with Team scope; rate limit `api-deployments-get` 500/min.
- Spend Management: "available on Enterprise and Pro plans" (https://vercel.com/docs/spend-management); Hobby table says "Spend Management: N/A". Not available on Hobby.
- Usage notifications: "All plans receive notifications by email and on the dashboard when they are approaching and exceed their usage limits" and "Hobby plans will be paused when they exceed the included free tier usage" (https://vercel.com/docs/plans). Thresholds are **not** published for Hobby; "Customizing on-demand usage notifications is available on Pro plans" and "Emails are sent out at specific usage thresholds which vary based on the feature and plan" (https://vercel.com/docs/notifications). No 75%/100% figure for Hobby in docs.
- Usage CSV/export: nothing in the usage docs. Only Web Analytics panel export (community hint, unverified) and Drains (Pro/Enterprise). `TODO(verify)`.
- `GET /v2/user` → `softBlock` object (`blockedAt`, `blockedDueToOverageType`, `unpauseAt`) tells you if the account is currently paused for overage (https://vercel.com/docs/rest-api/user/get-the-user).

## 7. Rate limits (hourly polling)
- https://vercel.com/docs/limits#rate-limits: no generic per-token limit; limits are per endpoint, 429 + `rate_limit_exceeded`. Relevant rows: `api-teams-get` 600/60s (user), `api-deployments-get` 500/60s (user), `api-artifacts-free` 100/60s. **No row for `/v1/billing/charges`** → `TODO(verify)` by observing 429s; hourly polling is far below any listed limit. Getting-started page: 429 = "platform-wide API rate limit... Reduce the request rate and retry after the limit resets" (https://vercel.com/docs/rest-api/getting-started).

## Metric table
| Metric | Obtainable via API on Hobby? | Endpoint | Notes |
|---|---|---|---|
| Fast Data Transfer (GB) | Likely (unverified) | `GET /v1/billing/charges` | Expect a `ServiceName` row with `ConsumedQuantity`; names/units not documented |
| CDN Requests (ex "Edge Requests") | Likely (unverified) | `GET /v1/billing/charges` | Same |
| Function Invocations | Likely (unverified) | `GET /v1/billing/charges` | Same |
| Active CPU / Provisioned Memory | Likely (unverified) | `GET /v1/billing/charges` | Replaces "GB-hours" |
| Image Transformations / cache r/w | Likely (unverified) | `GET /v1/billing/charges` | Same |
| Build minutes | Yes | `GET /v7/deployments` + `GET /v13/deployments/{id}` | `duration.timeForBilling` ms; no Hobby allotment to compare against |
| Deployments today | Yes | `GET /v7/deployments?since=` | Count vs 100/day |
| Projects count | Yes | `GET /v10/projects` | vs 200 |
| Plan detection | Yes | `GET /v2/teams/{teamId}` | `billing.plan === "hobby"` |
| Paused-for-overage flag | Yes | `GET /v2/user` | `softBlock.*` |
| Limits / allotments | No | — | Hard-code from table below |
| Billing period start/end | No | — | Compute client-side |

## Free-tier limits (Hobby) — verified_at 2026-10-11
| Limit | Value | Source |
|---|---|---|
| Fast Data Transfer | 100 GB / month | https://vercel.com/pricing ; /docs/plans/hobby |
| Fast Origin Transfer | 10 GB / month | https://vercel.com/pricing |
| CDN Requests | 1M / month | https://vercel.com/pricing |
| Function Invocations | 1M / month | https://vercel.com/pricing |
| Fluid Active CPU | 4 hours / month | https://vercel.com/pricing |
| Fluid Provisioned Memory | 360 GB-hrs / month | https://vercel.com/pricing |
| Image Optimization Transformations | 5K / month (cache reads 300K, writes 100K) | https://vercel.com/pricing |
| Build execution minutes | not metered/listed; 45 min max per build; 1 concurrent | https://vercel.com/docs/limits |
| Deployments per day | 100 (also 100/hour, 60 per 5 min) | https://vercel.com/docs/limits |
| Projects | 200 | https://vercel.com/docs/limits |
| Function max duration | 300 s default and max; 2 GB / 1 vCPU | https://vercel.com/docs/limits |
| Web Analytics events | 50K / month | https://vercel.com/docs/plans/hobby |
| Runtime logs retention | 1 hour | https://vercel.com/docs/plans/hobby |
| Commercial use | Not allowed | https://vercel.com/docs/limits/fair-use-guidelines |

## Open TODO(verify)
1. Live-call `GET /v1/billing/charges?from=&to=` with a Hobby team token: does it 200 with `Usage` rows and non-null `ConsumedQuantity`, or return empty/403? Record actual `ServiceName`/`ConsumedUnit`/`SkuId` strings (not documented).
2. What window `vercel usage` (no flags) uses as "current billing period" on Hobby — calendar month vs trailing 30 days.
3. Rate limit for `/v1/billing/charges` (absent from the limits table).
4. Whether any usage CSV export exists on the Usage dashboard (not found in docs).
5. Hobby usage-notification thresholds (docs only say "vary based on the feature and plan").
