import { req, save, need, scrub } from '../_lib.mjs';
need('VERCEL_TOKEN');
const vh = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
const tok = await req('token-meta', 'https://api.vercel.com/v5/user/tokens/current', { headers: vh });
const teamId = process.env.VERCEL_TEAM_ID || tok.body?.token?.scopes?.find((s) => s.type === 'team')?.teamId;
const sec = (d) => new Date(Math.floor(d / 1000) * 1000).toISOString();
const end = sec(Date.now()), start = sec(Date.now() - 6 * 3600e3);
const out = {};
for (const metric of ['vercel.request.count', 'vercel.function_invocation.count', 'vercel.image_transformation.count', 'vercel.analytics.page_view.count']) {
  const body = { scope: { ownerId: teamId }, timeRange: { start, end }, bucketSeconds: 3600, metrics: { value: { metric, aggregation: 'count' } }, outputs: ['value'] };
  const r = await req(`metrics-v1 ${metric}`, `https://api.vercel.com/metrics/v1?teamId=${teamId}`, { method: 'POST', headers: vh, body: JSON.stringify(body) });
  out[metric] = r.body ?? r.text; console.log('  ', metric, r.status, scrub(JSON.stringify(r.body ?? r.text)).slice(0, 300));
}
save('alt-routes-vercel-metrics-v1-count', out);
