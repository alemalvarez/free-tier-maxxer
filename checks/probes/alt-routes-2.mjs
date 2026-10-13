import { req, save, need, scrub } from '../_lib.mjs';
need('VERCEL_TOKEN');
const vh = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
const tok = await req('token-meta', 'https://api.vercel.com/v5/user/tokens/current', { headers: vh });
const teamId = process.env.VERCEL_TEAM_ID || tok.body?.token?.scopes?.find((s) => s.type === 'team')?.teamId;
const sec = (d) => new Date(Math.floor(d / 1000) * 1000).toISOString();
const end = sec(Date.now()), start = sec(Date.now() - 6 * 3600e3);
const out = {};
for (const metric of ['vercel.request.fdt_out_bytes', 'vercel.request.count', 'vercel.function_invocation.count', 'vercel.image_transformation.count']) {
  const body = { scope: { ownerId: teamId }, timeRange: { start, end }, bucketSeconds: 3600, metrics: { value: { metric, aggregation: 'sum' } }, outputs: ['value'] };
  const r = await req(`metrics-v1 ${metric}`, `https://api.vercel.com/metrics/v1?teamId=${teamId}`, { method: 'POST', headers: vh, body: JSON.stringify(body) });
  out[metric] = r.body ?? r.text; console.log('  ', metric, r.status, scrub(JSON.stringify(r.body ?? r.text)).slice(0, 400));
}
const wa = { scope: { ownerId: teamId }, timeRange: { start, end }, bucketSeconds: 3600, metrics: { value: { metric: 'vercel.analytics.page_view.count', aggregation: 'sum' } }, outputs: ['value'] };
const r = await req('metrics-v1 analytics', `https://api.vercel.com/metrics/v1?teamId=${teamId}`, { method: 'POST', headers: vh, body: JSON.stringify(wa) });
out.analytics = r.body ?? r.text; console.log('   analytics', r.status, scrub(JSON.stringify(r.body ?? r.text)).slice(0, 400));
save('alt-routes-vercel-metrics-v1', out);
