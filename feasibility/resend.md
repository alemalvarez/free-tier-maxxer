# Resend — feasibility (docs researched 2026-10-16; live check pending)

## Verdict
**FEASIBLE (docs), best-in-class shape.** Since 2026-10-01 Resend has `GET https://api.resend.com/usage`, one call that returns every
quota with `used`, `limit` and reset times. Daily history comes from `GET /emails/metrics` with `dimensions=period`.
The catch is auth: the changelog says to call it "with a full access API key", and Resend only offers two permissions,
`full_access` and `sending_access`. There is no read-only key. TODO(verify) live: whether `sending_access` is rejected (expected
`restricted_api_key` 401) and whether `/usage` is gated to a beta (one third-party summary claimed "private beta"; the API reference
page shows no such note).

## Free plan limits (resend.com/pricing, read 2026-10-16)
| Quota | Free | Notes |
|---|---|---|
| Emails per month | 3,000 | calendar month |
| Emails per day | 100 | rolling 24 h; "daily caps only apply to the free tier"; sending pauses at the cap |
| Domains | 3 | third-party reviews say 1; pricing page says 3; the API reports the real `domains.limit` |
| Inboxes | 3 | |
| Webhook endpoints | 1 | |
| AI credits | 5 / month | |
| Automation runs | 10,000 / month | no overage |
| Contacts (marketing) | 1,000 | |
| Segments | 3 | |
| Data retention | 30 days | affects how far back `/emails/metrics` can go |
| API rate limit | 10 req/s per team by default (API intro); `/usage` also returns `rate_limit` | same on every plan |
Next tier: Pro, $20/mo, 50,000 emails, no daily cap.

## Usage API (`GET /usage`, docs /api-reference/usage/retrieve-usage, changelog /changelog/account-usage-api, 2026-10-01)
Response (field meanings from the docs):
| Field | Shape | Meaning |
|---|---|---|
| `emails.daily` | `{used, limit, sent, received, resets_at}` | rolling 24 h; `limit` null on paid plans |
| `emails.monthly` | `{used, limit, sent, received, resets_at}` | calendar month; `limit` always a number |
| `contacts` | `{used, limit}` | |
| `segments` | `{used, limit}` | `limit` null with a contacts subscription |
| `broadcasts` | `{used, limit:null}` | no cap |
| `ai_credits` | `{used, limit, next_increase_at}` | |
| `automation_runs` | `{used, limit, resets_at}` | |
| `domains` | `{used, limit}` | `limit` null when uncapped |
| `rate_limit` | `{limit, duration}` | e.g. 1000 per "1000ms" in the example (TODO(verify) on Free; intro says 10/s) |
`limit: null` means no cap. `used` for emails = sent + received in the docs example. Also exposed by the CLI (`resend usage --json`)
and the MCP server (`get-usage`). Plan is not returned; `emails.daily.limit === null` implies a paid sending plan.

## Daily history (`GET /emails/metrics`, docs /api-reference/emails/get-metrics)
`?start_date&end_date&granularity=daily&dimensions=period&metrics=sent,received,delivered` → `data[{period:"YYYY-MM-DD", sent, received, ...}]`,
plus `totals`. Defaults: last 7 days, UTC. Max 10,000 periods. Older than the retention window is clamped (30 days on Free).
Responses cached up to 15 minutes. No plan or permission requirement stated.

## Quota headers (docs /api-reference/rate-limit "Usage Limits")
Every response carries `ratelimit-limit`, `ratelimit-remaining`, `ratelimit-reset`. Send responses carry `x-resend-monthly-quota`
("your used monthly email sending quota") and, on Free only, `x-resend-daily-quota`. Useful as a zero-cost cross-check but `/usage` supersedes them.

## Token / scope
| Permission | Can | Usable here? |
|---|---|---|
| `full_access` | "create, delete, get, and update any resource" | yes (changelog's stated requirement for `/usage`) |
| `sending_access` (+ optional `domain_id`) | "only send emails" | TODO(verify): expected 401 `restricted_api_key` on `/usage` |
Consequence for the brief's read-only principle: Resend forces a write-capable key. Mitigations: a dedicated key named for this tool,
stored only in `.env`, revocable from resend.com/api-keys; Resend auto-revokes keys leaked to public GitHub (changelog 2026-07-16).
Document this in the provider table as the one exception.

## Check script
`npm run check:resend` → `checks/resend.mjs`: `/usage`, `/domains` (for the account label and the headers), `/emails/metrics` daily.
Outputs: `checks/out/resend-usage.json`, `resend-domains.json`, `resend-metrics.json`. Builder maps them to the `resend` provider.

## Sources
- https://resend.com/pricing
- https://resend.com/docs/api-reference/usage/retrieve-usage
- https://resend.com/changelog/account-usage-api
- https://resend.com/docs/api-reference/emails/get-metrics
- https://resend.com/docs/api-reference/rate-limit
- https://resend.com/docs/api-reference/api-keys/create-api-key
- https://resend.com/docs/dashboard/api-keys/introduction
