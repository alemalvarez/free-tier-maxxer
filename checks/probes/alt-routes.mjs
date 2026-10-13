// Read-only probes of alternative usage routes (Vercel observability API, Supabase platform/analytics endpoints).
import { req, save, need, scrub, monthStart, now } from '../_lib.mjs';
need('VERCEL_TOKEN', 'SUPABASE_ACCESS_TOKEN', 'SUPABASE_ORG_SLUG', 'SUPABASE_PROJECT_REF');
const show = (label, r) => console.log(`  ${label}: ${r.status}`, scrub(r.body ? JSON.stringify(r.body).slice(0, 500) : r.text.slice(0, 400)));

// ---- Vercel
const vh = { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, 'Content-Type': 'application/json' };
const tok = await req('token-meta', 'https://api.vercel.com/v5/user/tokens/current', { headers: vh });
const teamId = process.env.VERCEL_TEAM_ID || tok.body?.token?.scopes?.find((s) => s.type === 'team')?.teamId;
const projects = await req('projects', `https://api.vercel.com/v9/projects?teamId=${teamId}&limit=1`, { headers: vh });
const projectId = projects.body?.projects?.[0]?.id;
const since = new Date(Date.now() - 6 * 3600e3).toISOString();
const out = {};
let r = await req('obs-schema', `https://api.vercel.com/v2/observability/schema?teamId=${teamId}`, { headers: vh });
out.obsSchema = r.body ?? r.text; show('obs-schema', r);
r = await req('obs-schema-metric', `https://api.vercel.com/v2/observability/schema/vercel.request.count?teamId=${teamId}`, { headers: vh });
out.obsSchemaMetric = r.body ?? r.text; show('obs-schema-metric', r);
const legacyBody = { scope: { ownerId: teamId, type: 'project', projectIds: [projectId] }, metric: 'vercel.request.count', aggregation: 'sum', startTime: since, endTime: now, granularity: { hours: 1 }, limit: 10 };
r = await req('obs-query', `https://api.vercel.com/v2/observability/query?teamId=${teamId}`, { method: 'POST', headers: vh, body: JSON.stringify(legacyBody) });
out.obsQuery = r.body ?? r.text; show('obs-query', r);
const canonBody = { scope: { ownerId: teamId, projectIds: [projectId] }, timeRange: { start: since, end: now }, bucketSeconds: 3600, metrics: { value: { metric: 'vercel.request.fdt_out_bytes', aggregation: 'sum' } }, outputs: ['value'] };
r = await req('metrics-v1', `https://api.vercel.com/metrics/v1?teamId=${teamId}`, { method: 'POST', headers: vh, body: JSON.stringify(canonBody) });
out.metricsV1 = r.body ?? r.text; show('metrics-v1', r);
r = await req('dash-usage-analytics', `https://vercel.com/api/v1/usage/analytics?from=${monthStart}&to=${now}&teamId=${teamId}`, { headers: vh });
out.dashUsageAnalytics = r.body ?? r.text; show('dash-usage-analytics', r);
r = await req('wa-visits-count', `https://api.vercel.com/v1/query/web-analytics/visits/count?teamId=${teamId}&projectId=${projectId}`, { headers: vh });
out.waVisits = r.body ?? r.text; show('wa-visits-count', r);
save('alt-routes-vercel', out);

// ---- Supabase
const B = 'https://api.supabase.com';
const sh = { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` };
const slug = process.env.SUPABASE_ORG_SLUG, ref = process.env.SUPABASE_PROJECT_REF;
const sout = {};
for (const [label, url] of [
  ['platform-org-usage', `${B}/platform/organizations/${slug}/usage`],
  ['platform-org-usage-daily', `${B}/platform/organizations/${slug}/usage/daily?start=${monthStart}&end=${now}`],
  ['platform-org-subscription', `${B}/platform/organizations/${slug}/billing/subscription`],
  ['v1-org-usage', `${B}/v1/organizations/${slug}/usage`],
  ['v1-metrics-scrape', `${B}/v1/projects/${ref}/analytics/endpoints/metrics`],
  ['v1-logs', `${B}/v1/projects/${ref}/analytics/endpoints/logs?sql=${encodeURIComponent("select count(*) as n from edge_logs")}&iso_timestamp_start=${since}&iso_timestamp_end=${now}`],
  ['v1-api-requests-count', `${B}/v1/projects/${ref}/analytics/endpoints/usage.api-requests-count?interval=1day`],
  ['v1-functions-stats', `${B}/v1/projects/${ref}/analytics/endpoints/functions.combined-stats?interval=1day`],
  ['v1-api-keys-list', `${B}/v1/projects/${ref}/api-keys`],
]) {
  const r = await req(label, url, { headers: sh });
  sout[label] = r.body ?? r.text; show(label, r);
}
save('alt-routes-supabase', sout);
