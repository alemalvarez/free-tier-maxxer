import { req, save, need, scrub, monthStart, now } from '../_lib.mjs';
need('VERCEL_TOKEN');
const B = 'https://api.vercel.com';
const h = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` };
const tq = process.env.VERCEL_TEAM_ID ? `teamId=${process.env.VERCEL_TEAM_ID}` : '';

const user = await req('user', `${B}/v2/user`, { headers: h });
save('vercel-user', user.body ?? user.text);
const uu = user.body?.user ?? {};
console.log('  user: id present=', !!uu.id, '| defaultTeamId present=', !!uu.defaultTeamId, '| softBlock=', scrub(uu.softBlock ?? null), '| billing keys=', uu.billing ? Object.keys(uu.billing).join(',') : null);

const teams = await req('teams', `${B}/v2/teams`, { headers: h });
save('vercel-teams', teams.body ?? teams.text);
for (const t of teams.body?.teams ?? []) console.log(`  team ${t.slug} | plan=${t.billing?.plan} | createdAt=${t.createdAt} | billing.period=${scrub(t.billing?.period ?? null)}`);
const teamId = process.env.VERCEL_TEAM_ID || teams.body?.teams?.[0]?.id || uu.defaultTeamId;

const tryCharges = async (label, qs) => {
  const r = await req(label, `${B}/v1/billing/charges?from=${monthStart}&to=${now}${qs}`, { headers: { ...h, 'Accept-Encoding': 'identity' } });
  const lines = r.text.split('\n').filter(Boolean);
  const rows = lines.map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
  save(`vercel-charges${label === 'charges' ? '' : '-' + label}`, rows);
  console.log(`  ${label}: ${rows.length} rows`);
  const summary = {};
  for (const r of rows) {
    const k = `${r.ChargeCategory} | ${r.ServiceName} | ${r.SkuId} | ${r.ConsumedUnit}`;
    summary[k] = (summary[k] ?? 0) + (Number(r.ConsumedQuantity) || 0);
  }
  for (const [k, v] of Object.entries(summary)) console.log(`    ${k} => ${v}`);
  if (!rows.length) console.log('    body:', scrub(r.text).slice(0, 300));
  return r;
};
const c = await tryCharges('charges', tq ? `&${tq}` : '');
if (c.status === 403 && !tq && teamId) await tryCharges('charges-with-teamId', `&teamId=${teamId}`);
