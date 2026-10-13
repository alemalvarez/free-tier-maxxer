import { req, save, need, scrub, monthStart, now } from '../_lib.mjs';
need('VERCEL_TOKEN');
const h = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
const tok = await req('token-meta', 'https://api.vercel.com/v5/user/tokens/current', { headers: h });
const teamId = process.env.VERCEL_TEAM_ID || tok.body?.token?.scopes?.find((s) => s.type === 'team')?.teamId;
const from = Date.parse(monthStart), to = Date.now();
for (const [label, url] of [
  ['v1/usage ms', `https://api.vercel.com/v1/usage?from=${from}&to=${to}&teamId=${teamId}`],
  ['v1/usage iso', `https://api.vercel.com/v1/usage?from=${monthStart}&to=${now}&teamId=${teamId}`],
]) {
  const r = await req(label, url, { headers: h });
  save(`vercel-${label.replace(/[^a-z0-9]+/gi, '-')}`, r.body ?? r.text);
  console.log(`  ${label}: ${r.status}`, scrub(r.body ? JSON.stringify(r.body).slice(0, 600) : r.text.slice(0, 300)));
}
