// Daily history from the official APIs: GitHub per-day billing rows (already saved by github.mjs),
// PostHog HogQL counts per day, Langfuse metrics by day. Output feeds concept/series.js via build-concept.mjs.
import { req, save, need, scrub, load, calendarMonth, anchoredPeriod } from './_lib.mjs';
const series = []; // {provider, metric, date: 'YYYY-MM-DD', value}
const push = (provider, metric, date, value) => { if (Number.isFinite(value)) series.push({ provider, metric, date, value }); };
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_');

// --- GitHub: raw usage has one row per day/sku/repo
const gh = load('github-usage');
if (gh?.usageItems) {
  const agg = {};
  for (const i of gh.usageItems) { const k = `${norm(i.sku)}|${String(i.date ?? '').slice(0, 10)}`; agg[k] = (agg[k] ?? 0) + Number(i.quantity); }
  for (const [k, v] of Object.entries(agg)) { const [sku, d] = k.split('|'); push('github', sku, d, v); }
} else console.log('github: no checks/out/github-usage.json yet (run github.mjs first)');

// --- PostHog: per-day HogQL counts (events, recordings)
if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_HOST && process.env.POSTHOG_PROJECT_ID) {
  const H = process.env.POSTHOG_HOST.replace(/\/$/, '');
  const ph = { Authorization: `Bearer ${process.env.POSTHOG_API_KEY}`, 'Content-Type': 'application/json' };
  const from = (load('posthog-billing')?.billing_period?.current_period_start ?? calendarMonth().start).slice(0, 19).replace('T', ' ');
  const hog = async (label, query) => {
    const r = await req(label, `${H}/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`, { method: 'POST', headers: ph, body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }) });
    if (!r.body?.results) console.log('  ', label, 'error:', scrub(r.body?.error ?? r.body?.detail ?? r.text).slice(0, 200));
    return r.body?.results ?? [];
  };
  for (const [d, n] of await hog('events/day', `SELECT toDate(timestamp) AS d, count() AS n FROM events WHERE timestamp >= toDateTime('${from}') GROUP BY d ORDER BY d`)) push('posthog', 'events', String(d), Number(n));
  for (const [d, n] of await hog('recordings/day', `SELECT toDate(min_first_timestamp) AS d, count(DISTINCT session_id) AS n FROM raw_session_replay_events WHERE min_first_timestamp >= toDateTime('${from}') GROUP BY d ORDER BY d`)) push('posthog', 'recordings', String(d), Number(n));
} else console.log('posthog: env missing, skipping daily series');

// --- Langfuse: metrics v2 with day granularity (3 requests of the 100/day Hobby budget)
if (process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_HOST) {
  const L = process.env.LANGFUSE_HOST.replace(/\/$/, '');
  const lh = { Authorization: 'Basic ' + Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY}:${process.env.LANGFUSE_SECRET_KEY}`).toString('base64') };
  const period = anchoredPeriod(process.env.LANGFUSE_BILLING_ANCHOR_DAY);
  const lf = async (label, metric, view, filters = []) => {
    const q = { view, metrics: [{ measure: 'count', aggregation: 'count' }], filters, timeDimension: { granularity: 'day' }, fromTimestamp: period.start, toTimestamp: new Date().toISOString() };
    const r = await req(label, `${L}/api/public/v2/metrics?query=${encodeURIComponent(JSON.stringify(q))}`, { headers: lh });
    const rows = r.body?.data ?? [];
    if (!rows.length) console.log('  ', label, 'body:', scrub(r.text).slice(0, 200));
    for (const row of rows) push('langfuse', metric, String(row.time_dimension ?? row.date ?? Object.values(row)[0]).slice(0, 10), Number(row.count_count));
  };
  await lf('lf observations/day', 'observations', 'observations');
  await lf('lf traces/day', 'traces', 'observations', [{ column: 'isRootObservation', operator: '=', value: true, type: 'boolean' }]);
  await lf('lf scores/day', 'scores', 'scores-numeric');
} else console.log('langfuse: env missing, skipping daily series');

save('series-api', series);
const byPM = {};
for (const s of series) { const k = `${s.provider}/${s.metric}`; byPM[k] = (byPM[k] ?? 0) + 1; }
console.log('series points per metric:', JSON.stringify(byPM));
