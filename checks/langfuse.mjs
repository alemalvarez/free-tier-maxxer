// Langfuse Hobby: no billing API. Counts observations, root observations (= traces proxy) and scores via the Metrics API v2.
// Budget: Hobby allows 100 Metrics API requests per day; this script uses 4.
import { req, save, need, scrub, anchoredPeriod, now } from './_lib.mjs';
need('LANGFUSE_PUBLIC_KEY', 'LANGFUSE_SECRET_KEY', 'LANGFUSE_HOST');
const H = process.env.LANGFUSE_HOST.replace(/\/$/, '');
const h = { Authorization: 'Basic ' + Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString('base64') };
const period = anchoredPeriod(process.env.LANGFUSE_BILLING_ANCHOR_DAY);
const metrics = [{ measure: 'count', aggregation: 'count' }];
const Q = (view, filters = []) => encodeURIComponent(JSON.stringify({ view, metrics, filters, fromTimestamp: period.start, toTimestamp: now }));

const checks = [
  ['observations', Q('observations')],
  ['root-observations', Q('observations', [{ column: 'isRootObservation', operator: '=', value: true, type: 'boolean' }])],
  ['scores-numeric', Q('scores-numeric')],
  ['scores-categorical', Q('scores-categorical')],
];
const results = { period };
for (const [label, q] of checks) {
  const r = await req(label, `${H}/api/public/v2/metrics?query=${q}`, { headers: h });
  results[label] = r.body ?? r.text;
  console.log(`  ${label}:`, scrub(r.body ?? r.text).slice(0, 300));
}
save('langfuse-metrics', results);
