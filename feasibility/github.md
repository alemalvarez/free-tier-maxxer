# GitHub — free-tier usage API feasibility

**Verdict: FEASIBLE (personal Free plan)** — verified_at 2026-10-11, sources: official docs.github.com / github.blog / github.com/pricing only.

GitHub exposes a per-user billing usage report (`GET /users/{username}/settings/billing/usage` and `/usage/summary`) on the enhanced billing platform, readable with a fine-grained PAT holding the user "Plan" (read) permission, returning per-product/SKU quantities (minutes, GB, etc.) plus gross/discount/net dollar amounts. The *limits* are not returned by the API — they must be hardcoded from docs — and the old per-product endpoints (`/settings/billing/actions`, `/packages`, `/shared-storage`) are retired.

## 1. Endpoints

**Current (enhanced billing platform)** — reference: https://docs.github.com/en/rest/billing/usage

| Endpoint | Notes |
|---|---|
| `GET /users/{username}/settings/billing/usage` | "Gets a report of the total usage for a user." "Note: This endpoint is only available to users with access to the enhanced billing platform." Query: `year` (default current year), `month` (1–12), `day` (1–31). Status: 200/400/403/500/503. |
| `GET /users/{username}/settings/billing/usage/summary` | "public preview and is subject to change." "Only data from the past 24 months is accessible." Query: `year`, `month` (default current month), `day`, `repository` (owner/repo), `product`, `sku`. |
| `GET /users/{username}/settings/billing/premium_request/usage` | Copilot premium requests; query `year`,`month`,`day`,`model`,`product`. Only meaningful if the user bought their own Copilot plan (org-managed Copilot is excluded). |
| `GET /users/{username}/settings/billing/ai_credit/usage` | Same shape as premium_request; AI-credits (post June-2026 Copilot billing model). |

Documented example responses (copied from the reference page above; curl samples use header `X-GitHub-Api-Version: 2026-03-10`):

```json
// GET /users/{username}/settings/billing/usage
{ "usageItems": [ { "date": "2023-08-01", "product": "Actions", "sku": "Actions Linux",
    "quantity": 100, "unitType": "minutes", "pricePerUnit": 0.008,
    "grossAmount": 0.8, "discountAmount": 0, "netAmount": 0.8, "repositoryName": "user/example" } ] }
// GET /users/{username}/settings/billing/usage/summary
{ "timePeriod": { "year": 2025 }, "user": "monalisa", "usageItems": [ { "product": "Actions",
    "sku": "actions_linux", "unitType": "minutes", "pricePerUnit": 0.008, "grossQuantity": 1000,
    "grossAmount": 8, "discountQuantity": 0, "discountAmount": 0, "netQuantity": 1000, "netAmount": 8 } ] }
// GET /users/{username}/settings/billing/premium_request/usage
{ "timePeriod": { "year": 2025 }, "user": "monalisa", "usageItems": [ { "product": "Copilot",
    "sku": "Copilot Premium Request", "model": "GPT-5", "unitType": "requests", "pricePerUnit": 0.04,
    "grossQuantity": 100, "grossAmount": 4, "discountQuantity": 0, "discountAmount": 0, "netQuantity": 100, "netAmount": 4 } ] }
```
Schema notes: `usage` items carry `date`, `product`, `sku`, `quantity`, `unitType`, `pricePerUnit`, `grossAmount`, `discountAmount`, `netAmount`, optional `repositoryName`; `summary` items carry `grossQuantity`/`discountQuantity`/`netQuantity` plus amounts. No "included" or "limit" field exists.

**Retired (older per-product endpoints)** — https://github.blog/changelog/2025-09-25-product-specific-billing-apis-are-closing-down (published 2025-09-26, labelled "Retired"): `/settings/billing/actions`, `/settings/billing/packages`, `/settings/billing/shared-storage` "for enterprises, organizations, and users" are "no longer supported"; replacement is the consolidated usage endpoint. They are gone from the current REST reference — https://docs.github.com/en/rest/billing/billing now lists only `GET /orgs/{org}/settings/billing/advanced-security`. Earlier: Actions "Get workflow usage"/"Get workflow run usage" closed per https://github.blog/changelog/2025-02-02-actions-get-workflow-usage-and-get-workflow-run-usage-endpoints-closing-down. Old fields (`total_minutes_used`, `included_minutes`, `days_left_in_billing_cycle`, `estimated_paid_storage_for_month`, …) could not be re-read from any current official page → do not build on them.

## 2. Works on Free-plan personal accounts?

Yes, provided the account is on the enhanced billing platform. https://github.blog/changelog/2025-02-25-enhanced-billing-platform-is-now-available-for-personal-accounts/ : "As of February 13, 2025, new GitHub Free and Pro plan customers now have access to the enhanced billing platform"; existing personal accounts "will gain access … in the coming months". Search snippets of docs pages mention migration of personal accounts by June 30, 2025 and a current page saying the platform is "available to all users", but I could not read those sentences on a live page (the enhanced-billing-platform concept URL 404s) → TODO(verify) below. Restriction: the user-level Copilot endpoints exclude Copilot licences billed through an org/enterprise (https://docs.github.com/en/rest/billing/usage).

## 3. Authentication

- REST reference (https://docs.github.com/en/rest/billing/usage), per endpoint: "This endpoint works with the following fine-grained token types: GitHub App user access tokens, Fine-grained personal access tokens. The fine-grained token must have the following permission set: **"Plan" user permissions (read)**" (same for all four user endpoints; installation tokens are NOT listed).
- Permissions matrix confirms: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens — user permission "Plan" → `GET /users/{username}/settings/billing/{usage,usage/summary,premium_request/usage,ai_credit/usage}`, access: read.
- **Conflict:** https://docs.github.com/en/billing/tutorials/automate-usage-reporting says "The billing usage endpoints do not support fine-grained personal access tokens" and to use a classic PAT ("a personal access token with the required billing permissions"; scope name not stated). The REST reference and permissions matrix are the more specific/authoritative sources; treat the tutorial as stale, but verify empirically (TODO below). Classic PAT scope for the retired endpoints: not verifiable on current docs.

## 4. Billing period

- No period fields in the response beyond `date` (daily rows) / `timePeriod {year, month, day}` (summary). Derive the period yourself: call with `year`+`month` of the current UTC month, or filter daily rows.
- Metered products use calendar months: "The billing cycle for all metered products is a fixed period from the first day to the last day of the month" (https://docs.github.com/en/billing/using-the-billing-platform/about-billing-on-github); "starts at 00:00:00 UTC on the first day of each month and ends at 23:59:59 UTC on the last day of the month" (https://docs.github.com/en/billing/concepts/billing-cycles — page covers paid plans; Free not named). Actions: "At the start of each month, the minutes used by the account are reset to zero" (https://docs.github.com/en/billing/concepts/product-billing/github-actions). Copilot AI credits reset "at 00:00:00 UTC on the first day of each calendar month" (https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals).

## 5. Free-plan limits — see table below.

## 6. Rate limits (hourly polling)

https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api : 5,000 requests/hour per PAT (primary, shared with apps acting for the user); headers `x-ratelimit-limit/remaining/used/reset/resource`; secondary limits (100 concurrent, 900 points/min REST). Two to four GETs per hour is negligible. Handle 403/429 with `x-ratelimit-reset`, and 503 (documented status) with backoff.

## 7. Surprises

- Units + dollars: rows give `quantity`/`unitType` (e.g. `minutes`) and `pricePerUnit`/`gross`/`discount`/`net` amounts. The included allowance is expected to surface as `discountAmount`/`discountQuantity`, but the docs do not say so explicitly (TODO). Dashboard "may show your Actions usage as a dollar amount ('spend') rather than raw minutes" (Actions concept page).
- OS multipliers: current docs publish only per-minute rates, not multipliers: Linux 2-core `actions_linux` $0.006, Windows 2-core `actions_windows` $0.010, macOS `actions_macos` $0.062, Linux 1-core `actions_linux_slim` $0.002, arm64 Linux $0.005 (https://docs.github.com/en/billing/reference/actions-runner-pricing). How 2,000 included minutes are consumed by macOS/Windows jobs is not stated anywhere I read (TODO). Minutes "rounds … up to the nearest whole minute" per job (same page). Public repos on standard runners are free; included minutes cannot be used for larger runners.
- Freshness: artifact storage updates "within 6 to 12 hours" (Actions concept page); Codespaces totals "reported to the billing service every hour" (Codespaces concept page); no SLA for Actions minutes.
- Shared storage: Actions artifacts and Packages share the 500 MB storage allowance; Packages storage billed hourly as GB-hours/744; data transfer only counts for private packages and GITHUB_TOKEN downloads inside Actions are exempt (Packages page).
- `summary` endpoint is public preview; `usage` endpoint has no `hour` param (the tutorial mentions `hour` — enterprise level only).
- Without a payment method, usage hard-stops at the quota (Actions/Packages/Codespaces pages) — useful for the tool's "what happens at 100%" messaging.

## Metric table

| Metric | Obtainable via API? | Endpoint | Notes |
|---|---|---|---|
| Actions minutes used (private repos) | Yes | `/users/{u}/settings/billing/usage?year&month` (+`/summary` with `product=actions`) | `unitType: minutes`, per SKU (`actions_linux`, `actions_windows`, `actions_macos`…); sum `quantity`. Limit not returned. |
| Actions/Packages shared storage GB | Yes (expected) | same | Look for storage SKUs under product Actions/Packages; unit TODO(verify). |
| Packages data transfer GB | Yes (expected) | same | SKU/unit TODO(verify). |
| Codespaces compute hours / storage | Yes (expected) | same, `product=codespaces` | Reported hourly. SKU names TODO(verify). |
| Copilot premium requests / AI credits | Yes, only if self-paid Copilot | `/premium_request/usage`, `/ai_credit/usage` | Org-managed Copilot excluded. Copilot Free allowance figure not published. |
| Included limits / period boundaries | No | — | Hardcode from table below; period = UTC calendar month. |

## Free-tier limits (personal GitHub Free) — verified_at 2026-10-11

| Metric | Limit | Source |
|---|---|---|
| Actions minutes/month (private repos) | 2,000 | https://docs.github.com/en/billing/concepts/product-billing/github-actions ; https://github.com/pricing ; https://docs.github.com/en/get-started/learning-about-github/githubs-plans |
| Actions artifact storage (shared with Packages) | 500 MB | Actions page above |
| Actions cache storage | 10 GB per repository | Actions page above |
| Packages storage | 500 MB | https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-packages/about-billing-for-github-packages ; pricing page |
| Packages data transfer/month | 1 GB | Packages page above |
| Codespaces compute | 120 core hours/month ("120 hrs" in Codespaces page; "120 GitHub Codespaces core hours per month" in githubs-plans) | https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-codespaces/about-billing-for-github-codespaces ; githubs-plans |
| Codespaces storage | 15 GB-month | same |
| Copilot Free | 2,000 completions/month; AI-credit allowance exists but figure not published | https://docs.github.com/en/copilot/get-started/plans ; https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals |

## Open TODO(verify)

1. Fine-grained PAT really works: run `gh api -H "X-GitHub-Api-Version: 2026-03-10" /users/<me>/settings/billing/usage?year=2026&month=10` with a token holding only Plan:read; tutorial page claims it does not.
2. Whether *all* existing personal accounts are migrated to the enhanced billing platform (concept page https://docs.github.com/en/billing/concepts/enhanced-billing-platform returned 404; snippets cite "by June 30, 2025" and "available to all users" but unread).
3. Exact SKU / `unitType` strings for Packages storage, data transfer, Codespaces compute/storage, and how included allowance appears (`discountAmount`?) — only the Actions example is documented.
4. macOS/Windows consumption of included minutes (historic 2x/10x multiplier not present in current docs; only $ rates).
5. Retirement date / current HTTP behaviour of `/users/{u}/settings/billing/actions|packages|shared-storage` (changelog says "no longer supported", no date).
6. Copilot Free monthly AI-credit figure (not on plans or usage-based-billing pages).
7. Data lag for Actions minutes in the usage report (not documented).
