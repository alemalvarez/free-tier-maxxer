// Vercel with a team-scoped token: token metadata, team + plan, billing cycle, and the charges endpoint
// (which returns 404 costs_not_found on Hobby; kept here so the verdict can be re-checked).
import { req, save, need, scrub, monthStart, now } from './_lib.mjs';
need('VERCEL_TOKEN');
const B = 'https://api.vercel.com';
const h = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };

const tok = await req('token-meta', `${B}/v5/user/tokens/current`, { headers: h });
save('vercel-token-meta', tok.body ?? tok.text);
const t = tok.body?.token;
console.log('  token meta:', t ? `type=${t.type} origin=${t.origin} scopes=${JSON.stringify(t.scopes)} expiresAt=${t.expiresAt}` : scrub(tok.text).slice(0, 300));
const teamScope = t?.scopes?.find((s) => s.type === 'team');
const teamId = process.env.VERCEL_TEAM_ID || teamScope?.teamId;
console.log('  teamId resolved:', !!teamId);
if (!teamId) { console.log('  no team id: set VERCEL_TEAM_ID or use a team-scoped token'); process.exit(0); }

const team = await req('team', `${B}/v2/teams/${teamId}`, { headers: h });
save('vercel-team', team.body ?? team.text);
console.log('  team:', team.body?.slug ? `plan=${team.body.billing?.plan} createdAt=${team.body.createdAt} billingKeys=${Object.keys(team.body.billing ?? {}).join(',')}` : scrub(team.text).slice(0, 300));

// Undocumented but token-accepting: returns the current and previous billing cycle windows (ms epoch).
const cycles = await req('cycles', `${B}/v2/usage?cycles=1&teamId=${teamId}`, { headers: h });
save('vercel-cycles', cycles.body ?? cycles.text);
console.log('  cycles:', scrub(cycles.body ?? cycles.text).slice(0, 200));

const r = await req('charges+teamId', `${B}/v1/billing/charges?from=${monthStart}&to=${now}&teamId=${teamId}`, { headers: { ...h, 'Accept-Encoding': 'identity' } });
const lines = r.text.split('\n').filter(Boolean);
const rows = lines.map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
save('vercel-charges-teamId', rows);
console.log(`  charges: ${rows.length} lines (404 costs_not_found is the expected Hobby answer)`);
if (rows[0]?.error || rows[0]?.raw) console.log('    first line:', scrub(lines[0]).slice(0, 300));

const projects = await req('projects', `${B}/v9/projects?limit=5&teamId=${teamId}`, { headers: h });
console.log('  projects:', (projects.body?.projects ?? []).map((p) => p.name).join(', ') || scrub(projects.text).slice(0, 200));
const deps = await req('deployments', `${B}/v6/deployments?limit=3&teamId=${teamId}`, { headers: h });
const d = deps.body?.deployments ?? [];
console.log(`  deployments: ${d.length}`);
if (d[0]) {
  const one = await req('deployment', `${B}/v13/deployments/${d[0].uid}?teamId=${teamId}`, { headers: h });
  save('vercel-deployment', one.body ?? one.text);
  console.log('  deployment plan=', one.body?.plan, '| duration.timeForBilling=', one.body?.duration?.timeForBilling ?? null);
}
