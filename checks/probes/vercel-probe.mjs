import { req, save, need, scrub, monthStart, now } from '../_lib.mjs';
need('VERCEL_TOKEN');
const B = 'https://api.vercel.com';
const h = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };

const projects = await req('projects', `${B}/v9/projects?limit=5`, { headers: h });
save('vercel-projects', projects.body ?? projects.text);
const ps = projects.body?.projects ?? [];
for (const p of ps) console.log(`  project ${p.name} | accountId=${p.accountId} | framework=${p.framework}`);
if (!ps.length) console.log('  body:', scrub(projects.text).slice(0, 300));
const teamId = ps[0]?.accountId;

if (teamId) {
  const team = await req('team', `${B}/v2/teams/${teamId}`, { headers: h });
  save('vercel-team', team.body ?? team.text);
  console.log('  team:', team.body ? `slug=${team.body.slug} plan=${team.body.billing?.plan} createdAt=${team.body.createdAt} billingKeys=${Object.keys(team.body.billing ?? {}).join(',')}` : scrub(team.text).slice(0, 300));

  for (const [label, url] of [
    ['charges+teamId', `${B}/v1/billing/charges?from=${monthStart}&to=${now}&teamId=${teamId}`],
    ['charges+teamId dates-only', `${B}/v1/billing/charges?from=${monthStart.slice(0,10)}&to=${now.slice(0,10)}&teamId=${teamId}`],
  ]) {
    const r = await req(label, url, { headers: { ...h, 'Accept-Encoding': 'identity' } });
    const lines = r.text.split('\n').filter(Boolean);
    console.log(`  ${label}: status ${r.status}, ${lines.length} lines; first:`, scrub(lines[0] ?? '').slice(0, 400));
    save(`vercel-${label.replace(/[^a-z]+/gi, '-')}`, lines.map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } }));
  }
  const deps = await req('deployments', `${B}/v6/deployments?limit=3&teamId=${teamId}`, { headers: h });
  const d = deps.body?.deployments ?? [];
  console.log(`  deployments: ${d.length}; first keys:`, d[0] ? Object.keys(d[0]).join(',') : scrub(deps.text).slice(0, 200));
  if (d[0]) {
    const one = await req('deployment', `${B}/v13/deployments/${d[0].uid}?teamId=${teamId}`, { headers: h });
    console.log('  deployment.duration/timeForBilling:', scrub(one.body?.duration ?? one.body?.timeForBilling ?? null), '| plan=', one.body?.plan);
    save('vercel-deployment', one.body ?? one.text);
  }
}
