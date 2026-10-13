import { req, save, need, scrub } from '../_lib.mjs';
need('VERCEL_TOKEN');
const h = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
const tok = await req('token-meta', 'https://api.vercel.com/v5/user/tokens/current', { headers: h });
const teamId = process.env.VERCEL_TEAM_ID || tok.body?.token?.scopes?.find((s) => s.type === 'team')?.teamId;
for (const [label, url] of [
  ['api.vercel.com /v2/usage', `https://api.vercel.com/v2/usage?cycles=1&teamId=${teamId}`],
  ['vercel.com /api/v2/usage', `https://vercel.com/api/v2/usage?cycles=1&teamId=${teamId}`],
  ['api.vercel.com /v1/usage', `https://api.vercel.com/v1/usage?teamId=${teamId}`],
]) {
  const r = await req(label, url, { headers: h });
  save(`vercel-unofficial-${label.replace(/[^a-z0-9]+/gi, '-')}`, r.body ?? r.text);
  console.log(`  ${label}: ${r.status}`, scrub(r.body ? JSON.stringify(r.body).slice(0, 400) : r.text.slice(0, 300)));
}
