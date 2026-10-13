# Vercel — unofficial route (verified 2026-10-11 in a logged-in browser)

## Summary
The Vercel dashboard has **no JSON usage API** behind the Usage page. The page is a Next.js server component whose
HTML already contains every usage meter as an `initialData.meterData` object, plus the billing cycle windows.
A plain `GET https://vercel.com/<team-slug>/~/usage` with the user's session cookie returns ~5.4 MB of HTML in which the
meters can be extracted by regex. No JavaScript execution is needed. This is the only route to bandwidth, requests,
invocations and image optimization on Hobby.

## What the dashboard itself calls (network capture)
| Call | Result | Note |
|---|---|---|
| `POST vercel.com/api/v2/billing/costs?teamId&from&to` | 404 | Same failure as public `/v1/billing/charges` → Hobby has no cost records |
| `GET vercel.com/api/v2/usage?cycles=1&teamId` | 200 | Returns only `{current:{start,end}, previous:{start,end}}`. Also works on `api.vercel.com/v2/usage` **with the `vcp_` token**. Cycle observed = calendar month UTC (2026-10-01 → 2026-11-01). |
| `GET api.vercel.com/v1/usage?from=<ISO>&to=<ISO>&teamId` | 400 `plan_upgrade_required` | "only available to Teams on the Pro or Enterprise plan". Explicit gate; undocumented endpoint. |
| document `GET /<slug>/~/usage` | 200 HTML | Contains all meters (below). |

## Extraction
- In the HTML, data lives inside `self.__next_f.push([1,"..."])` chunks with escaped quotes. Unescape `\"` → `"` then match
  `"batchKey":"<key>"` … `"meterData":{ "nextTier", "limit", "value", "increment", "pricePerIncrement" }`.
- Billing cycle: `"billingCycles":{"current":{"start":<ms>,"end":<ms>},"previous":{...}}`.
- Each card also carries `"getData":"$h…"` — a server-action reference used for client refresh (batched by `batchKey`). Replaying
  server actions requires the action id from the JS bundle; not needed since SSR already has the values.
- Fragile points: batchKey names, the `new-` prefix, the meterData field names, and the page route. Must be marked `source: unofficial`,
  `confidence: approximate`, and the adapter needs a contract test against a saved HTML fixture.

## Meters observed (value / limit, raw units)
| batchKey | value | limit | Interpretation |
|---|---|---|---|
| new-fast_data_transfer | 118,951,307 | 100,000,000,000 | bytes; Hobby 100 GB |
| new-fast_origin_transfer | 88,680,773 | 10,000,000,000 | bytes; 10 GB |
| new-edge_requests | 13,094 | 1,000,000 | count; "CDN Requests" |
| new-edge_request_cpu_duration | 4,450 | 3,600,000 | ms; 1 CPU-hour |
| new-function_invocations | 13,516 | 1,000,000 | count |
| new-function_duration | 0 | 360,000,000,000 | GB-ms → 360 GB-hrs |
| new-fluid_cpu_duration | 766,470 | 14,400,000 | ms → 4 CPU-hrs ("Fluid Active CPU") |
| new-data_cache_reads | 3,102 | 1,000,000 | count (ISR reads) |
| new-data_cache_writes | 3,154,044,928 | 1,296,000,000,000 | bytes? (ISR writes shown as 20 in UI → units need a check) |
| new-image_transformations | 0 | 5,000 | count |
| new-deployment_storage_size | 68,748,556 | 10,000,000,000 | bytes |
| new-deployment_lambda_storage_size | 292,354,284 | 10,000,000,000 | bytes |
| new-build_cpu | 11,520,000 | null | ms → 3h 12m; no Hobby limit |
| new-blob_data_transfer | 0 | 10,000,000,000 | bytes |
| new-blob_simple_operations / advanced | 0 | 10,000 / 2,000 | count |
| new-flag_requests | 0 | 18,000,000 | count |
| new-speed_insights_free_data_points | 0 | 10,000 | count |
| observability-web-analytics | 0 | 50,000 | count |
| edge-middleware | 0 | 500,000 | count |
| others (queues, drive, sandbox, edge config, cron, artifacts) | 0 | null or 0 | 49 meters total; see checks/out/vercel-ssr-meters.json |

Units are inferred from the UI labels next to each number (e.g. 118,951,307 ↔ "118.95 MB"), not documented → `TODO(verify)` per meter
before mapping to limits.yaml. Note `new-data_cache_writes` disagrees with the UI "ISR Writes 20" and needs a second look.

## Auth
- Session cookie only. The `vcp_` API token is rejected for the document route (it is a web page, not an API).
- Cookie is httpOnly; the tool would need the user to paste it from devtools, or a one-time Playwright login that persists
  `storageState` locally (600 perms). Either way this adapter is **not** "read-only scoped token" and must be labelled as such.

## Verdict
UNOFFICIAL ROUTE, token-free but cookie-bound. Fully covers the Hobby limits. Ship as an opt-in `vercel-dashboard` adapter
behind an explicit `experimental: true` flag, with the official `vercel` adapter (plan, build minutes via deployments) as default.
