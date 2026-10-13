import { req, save, need, scrub } from '../_lib.mjs';
need('SUPABASE_ACCESS_TOKEN', 'SUPABASE_ORG_SLUG');
const B = 'https://api.supabase.com';
const slug = process.env.SUPABASE_ORG_SLUG;
const h = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, Accept: 'application/json' };
for (const [label, url] of [
  ['platform usage', `${B}/platform/organizations/${slug}/usage`],
  ['platform subscription', `${B}/platform/organizations/${slug}/billing/subscription`],
  ['platform usage/daily', `${B}/platform/organizations/${slug}/usage/daily?start=2026-10-01T00:00:00Z&end=2026-10-11T23:59:59Z`],
  ['v1 org (recheck)', `${B}/v1/organizations/${slug}`],
]) {
  const r = await req(label, url, { headers: h });
  save(`supabase-unofficial-${label.replace(/[^a-z0-9]+/gi, '-')}`, r.body ?? r.text);
  console.log(`  ${label}: ${r.status}`, scrub(r.body ? JSON.stringify(r.body).slice(0, 300) : r.text.slice(0, 300)));
}
