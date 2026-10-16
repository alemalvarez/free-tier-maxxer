// Resend: GET /usage (added 2026-10-01) returns every quota with used, limit and reset time in one call.
// Also probes GET /emails/metrics for daily history and records the quota headers Resend adds to responses.
import { req, save, need, scrub } from './_lib.mjs';
need('RESEND_API_KEY');
const B = 'https://api.resend.com';
const h = { Authorization: `Bearer ${process.env.RESEND_API_KEY}` };

const usage = await req('usage', `${B}/usage`, { headers: h });
save('resend-usage', usage.body ?? usage.text);
const u = usage.body;
if (u?.object === 'usage') {
  for (const [k, v] of Object.entries(u)) {
    if (k === 'object') continue;
    if (k === 'emails') { for (const w of ['daily', 'monthly']) console.log(`  emails.${w}: used=${v[w]?.used} limit=${v[w]?.limit} sent=${v[w]?.sent} received=${v[w]?.received} resets_at=${v[w]?.resets_at}`); continue; }
    console.log(`  ${k}: ${scrub(v)}`.replace(/\n\s*/g, ' '));
  }
} else console.log('  usage body:', scrub(usage.body ?? usage.text).slice(0, 400));

// response headers: rate limit + quota headers (documented at /docs/api-reference/rate-limit)
const r = await fetch(`${B}/domains`, { headers: h });
const hdr = {};
for (const [k, v] of r.headers) if (/^(ratelimit-|x-resend-|retry-after)/.test(k)) hdr[k] = v;
console.log(`[domains] GET ${B}/domains -> ${r.status}; interesting headers:`, JSON.stringify(hdr));
let domains = null; try { domains = await r.json(); } catch {}
save('resend-domains', { status: r.status, headers: hdr, count: domains?.data?.length ?? null, domains: (domains?.data ?? []).map((d) => ({ name: d.name, status: d.status, region: d.region, created_at: d.created_at })) });

// daily history: emails metrics with period dimension (docs: /docs/api-reference/emails/get-metrics)
const since = new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const m = await req('metrics', `${B}/emails/metrics?start_date=${since}&end_date=${today}&granularity=daily&dimensions=period&metrics=sent,received,delivered`, { headers: h });
save('resend-metrics', m.body ?? m.text);
console.log('  metrics:', m.body?.data ? `${m.body.data.length} daily rows, totals ${JSON.stringify(m.body.totals)}` : scrub(m.body ?? m.text).slice(0, 400));
