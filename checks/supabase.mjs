import { req, save, need, scrub, anchoredPeriod } from './_lib.mjs';
need('SUPABASE_ACCESS_TOKEN', 'SUPABASE_ORG_SLUG', 'SUPABASE_PROJECT_REF');
const B = 'https://api.supabase.com';
const ref = process.env.SUPABASE_PROJECT_REF;
const h = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' };

const org = await req('org', `${B}/v1/organizations/${process.env.SUPABASE_ORG_SLUG}`, { headers: h });
save('supabase-org', org.body ?? org.text);
console.log('  org:', scrub(org.body ?? org.text).slice(0, 400));

const projects = await req('projects', `${B}/v1/projects`, { headers: h });
save('supabase-projects', projects.body ?? projects.text);
for (const p of projects.body ?? []) console.log(`  project ${p.ref} | ${p.name} | status=${p.status} | region=${p.region} | created=${p.created_at}`);

const sql = async (label, query, path = '/database/query') => {
  const r = await req(label, `${B}/v1/projects/${ref}${path}`, { method: 'POST', headers: h, body: JSON.stringify({ query, read_only: true }) });
  console.log(`  ${label}:`, scrub(r.body ?? r.text).slice(0, 300));
  return r.body ?? r.text;
};
const out = {};
out.db_size = await sql('db_size', `select pg_database_size(current_database()) as bytes`);
out.db_size_ro = await sql('db_size (read-only endpoint)', `select pg_catalog.pg_database_size(pg_catalog.current_database()) as bytes`, '/database/query/read-only');
out.storage = await sql('storage_size', `select coalesce(sum((metadata->>'size')::bigint),0) as bytes, count(*) as objects from storage.objects`);
out.period = anchoredPeriod(process.env.SUPABASE_BILLING_ANCHOR_DAY);
out.mau = await sql('mau', `select count(*) as mau from auth.users where last_sign_in_at >= '${out.period.start}'`);
const api = await req('usage.api-counts', `${B}/v1/projects/${ref}/analytics/endpoints/usage.api-counts?interval=1day`, { headers: h });
out.api_counts = api.body ?? api.text; console.log('  api-counts:', scrub(out.api_counts).slice(0, 300));
save('supabase-sql', out);
