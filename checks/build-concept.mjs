// Builds concept/data.js and concept/series.js from whatever is in checks/out/.
// Providers with no captures are left out; metrics a route cannot report are emitted as `used: null` with a reason.
// Usage: node checks/build-concept.mjs [--out concept/]      (reads .env if present, for anchor days and the project name)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { calendarMonth, anchoredPeriod, load } from './_lib.mjs';

// tiny .env reader so this works without --env-file (never prints values)
const envFile = new URL('../.env', import.meta.url);
if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const outDir = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : new URL('../concept/', import.meta.url).pathname; })();

const now = new Date();
const iso = (x) => new Date(x).toISOString();
const dayOf = (x) => iso(x).slice(0, 10);
const providers = [], series = [], notes = [];
const push = (provider, metric, date, value, kind = 'delta') => { if (date && Number.isFinite(value)) series.push({ provider, metric, date, value, kind }); };
const unavailable = (key, label, unit, resets, reason) => ({ key, label, used: null, limit: null, unit, resets, unavailable: reason });
const apiSeries = load('series-api') ?? [];
const fromApi = (provider, metricMap = {}) => { for (const s of apiSeries.filter((s) => s.provider === provider)) push(provider, metricMap[s.metric] ?? s.metric, s.date, s.value); };
const humanize = (k) => k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// ---------------- GitHub (official)
{
  const sum = load('github-summary');
  if (sum?.usageItems) {
    const tp = sum.timePeriod;
    const period = tp ? { start: iso(Date.UTC(tp.year, tp.month - 1, 1)), end: iso(Date.UTC(tp.year, tp.month, 1)), anchor: 'assumed', anchorNote: 'UTC calendar month per docs; not returned by the API' } : calendarMonth();
    const q = (sku) => sum.usageItems.filter((i) => i.sku === sku).reduce((a, i) => a + Number(i.grossQuantity ?? i.quantity ?? 0), 0);
    // Free plan: 2,000 Actions minutes per month; Windows counts 2x and macOS 10x against it. TODO(verify) the windows/macos SKU names.
    const minutes = q('actions_linux') + 2 * q('actions_windows') + 10 * q('actions_macos');
    const metrics = [
      { key: 'actions_minutes', label: 'Actions minutes (private repos)', used: minutes, limit: 2000, unit: 'minutes', resets: true },
      { key: 'actions_storage', label: 'Actions storage', used: q('actions_storage'), limit: null, unit: 'gbh', resets: true, note: 'No published cap in GB-hours on Free' },
      // TODO(verify): Packages storage SKU name; absent rows mean no usage.
      { key: 'packages_storage', label: 'Packages storage', used: q('packages_storage'), limit: 500e6, unit: 'bytes', resets: false, note: sum.usageItems.some((i) => i.sku === 'packages_storage') ? undefined : 'No SKU row returned: unused' },
    ];
    providers.push({ id: 'github', name: 'GitHub', account: sum.user ?? process.env.GITHUB_USERNAME ?? 'user', plan: 'Free', source: 'official', auth: 'fine-grained token, Plan: read', period, metrics });
    fromApi('github', { actions_linux: 'actions_minutes' });
  } else notes.push('github: no checks/out/github-summary.json (run checks/github.mjs)');
}

// ---------------- PostHog (official)
{
  const b = load('posthog-billing');
  if (b?.usage_summary) {
    const bp = b.billing_period;
    const period = bp?.current_period_start ? { start: bp.current_period_start, end: bp.current_period_end, anchor: 'api' } : calendarMonth();
    const LABELS = { events: 'Events', recordings: 'Session recordings', mobile_recordings: 'Mobile recordings', feature_flag_requests: 'Feature flag requests', exceptions: 'Error tracking exceptions', llm_events: 'LLM analytics events', survey_responses: 'Survey responses', rows_synced: 'Data warehouse rows', rows_exported: 'Rows exported', cdp_trigger_events: 'Realtime destination events', logs_mb_ingested: 'Logs ingested', ai_credits: 'AI credits', replay_vision_credits: 'Replay vision credits', signals_credits: 'Signals credits', workflow_emails: 'Workflow emails', workflow_destinations: 'Workflow destinations' };
    const prod = Object.fromEntries((b.products ?? []).map((p) => [p.usage_key, p]));
    const metrics = [];
    for (const [key, u] of Object.entries(b.usage_summary)) {
      if (!(u.limit > 0)) continue;
      const used = prod[key]?.current_usage ?? (Number(u.usage ?? 0) + Number(u.todays_usage ?? 0));
      metrics.push({ key, label: LABELS[key] ?? humanize(key), used, limit: u.limit, unit: key.includes('_mb_') ? 'mb' : 'count', resets: true });
    }
    const host = process.env.POSTHOG_HOST ?? '';
    const region = host.includes('eu.') ? 'EU cloud' : host.includes('us.') ? 'US cloud' : 'cloud';
    const plan = (b.subscription_level ?? 'free').replace(/^\w/, (c) => c.toUpperCase());
    providers.push({ id: 'posthog', name: 'PostHog', account: region, plan, source: 'official', auth: 'personal API key, billing:read', period, metrics });
    fromApi('posthog');
  } else notes.push('posthog: no checks/out/posthog-billing.json (run checks/posthog.mjs)');
}

// ---------------- Langfuse (official, approximate)
{
  const l = load('langfuse-metrics');
  const c = (k) => Number(l?.[k]?.data?.[0]?.count_count);
  if (l && Number.isFinite(c('observations'))) {
    const traces = c('root-observations'), obs = c('observations'), scores = (c('scores-numeric') || 0) + (c('scores-categorical') || 0);
    const period = l.period ?? anchoredPeriod(process.env.LANGFUSE_BILLING_ANCHOR_DAY);
    if (period.anchor === 'assumed') period.anchorNote = 'Billing anchors to your signup day; set LANGFUSE_BILLING_ANCHOR_DAY in .env';
    providers.push({ id: 'langfuse', name: 'Langfuse', account: (process.env.LANGFUSE_HOST ?? '').includes('us.') ? 'US cloud' : 'EU cloud', plan: 'Hobby', source: 'official', auth: 'project keys, Metrics API', period, metrics: [
      { key: 'units', label: 'Units (traces + observations + scores)', used: traces + obs + scores, limit: 50000, unit: 'count', resets: true, confidence: 'approximate', note: `traces ${traces} (root-observation proxy), observations ${obs}, scores ${scores}` },
    ] });
    fromApi('langfuse');
    const byDay = {};
    for (const s of apiSeries.filter((s) => s.provider === 'langfuse')) byDay[s.date] = (byDay[s.date] ?? 0) + s.value;
    for (const [d, v] of Object.entries(byDay)) push('langfuse', 'units', d, v);
  } else notes.push('langfuse: no checks/out/langfuse-metrics.json (run checks/langfuse.mjs)');
}

// ---------------- Supabase (dashboard capture preferred, official SQL fallback)
{
  const dash = load('supabase-dashboard'), projects = load('supabase-projects'), sql = load('supabase-sql');
  const proj = projects?.find?.((p) => p.ref === process.env.SUPABASE_PROJECT_REF) ?? projects?.[0];
  const status = proj?.status ? { label: 'Project status', value: proj.status, note: 'Free projects pause after 7 days without activity' } : undefined;
  const where = proj ? `project ${proj.name} (${proj.region})` : 'project';
  const GB = 1e9;
  const MAP = {
    EGRESS: ['egress', 'Egress', 'bytes', GB, true], CACHED_EGRESS: ['cached_egress', 'Cached egress', 'bytes', GB, true],
    DATABASE_SIZE: ['database_size', 'Database size', 'bytes', GB, false], STORAGE_SIZE: ['storage_size', 'Storage size', 'bytes', GB, false],
    MONTHLY_ACTIVE_USERS: ['monthly_active_users', 'Monthly active users', 'count', 1, true], MONTHLY_ACTIVE_THIRD_PARTY_USERS: ['monthly_active_third_party_users', 'Monthly active third-party users', 'count', 1, true], MONTHLY_ACTIVE_SSO_USERS: ['monthly_active_sso_users', 'Monthly active SSO users', 'count', 1, true],
    FUNCTION_INVOCATIONS: ['function_invocations', 'Edge function invocations', 'count', 1, true], REALTIME_MESSAGE_COUNT: ['realtime_message_count', 'Realtime messages', 'count', 1, true], REALTIME_PEAK_CONNECTIONS: ['realtime_peak_connections', 'Realtime peak connections', 'count', 1, true],
    LOG_INGESTION: ['log_ingestion', 'Log ingestion', 'bytes', GB, true], LOG_QUERYING: ['log_querying', 'Log querying', 'bytes', GB, true], STORAGE_IMAGES_TRANSFORMED: ['storage_images_transformed', 'Image transformations', 'count', 1, true],
  };
  if (dash?.usage?.usages) {
    const sub = dash.subscription;
    const period = sub?.current_period_start ? { start: iso(sub.current_period_start * 1000), end: iso(sub.current_period_end * 1000), anchor: 'api' } : anchoredPeriod(process.env.SUPABASE_BILLING_ANCHOR_DAY);
    const metrics = [];
    for (const u of dash.usage.usages) {
      const m = MAP[u.metric]; if (!m) continue;
      const [key, label, unit, scale, resets] = m;
      if (u.available_in_plan === false || u.pricing_free_units == null) continue;
      const row = { key, label, used: Number(u.usage_original ?? 0), limit: u.unlimited ? null : Number(u.pricing_free_units) * scale, unit, resets };
      if (key === 'database_size' && sql?.db_size?.[0]?.bytes) row.note = `SQL pg_database_size reports ${(Number(sql.db_size[0].bytes) / 1e6).toFixed(1)} MB; the dashboard figure is the quota one`;
      metrics.push(row);
    }
    providers.push({ id: 'supabase', name: 'Supabase', account: `org ${(sub?.plan?.name ?? 'Free')}, ${where}`, plan: sub?.plan?.name ?? 'Free', source: 'dashboard', auth: 'dashboard session (platform API)', period, status, metrics });
    for (const r of dash.daily?.usages ?? []) { const m = MAP[r.metric]; if (m) push('supabase', m[0], r.date, Number(r.usage_original ?? r.usage), m[0] === 'monthly_active_users' ? 'level' : 'delta'); }
    for (const r of dash.dbSize?.data ?? []) push('supabase', 'database_size', dayOf(r.period_start), Math.round(Number(r.pg_database_size)), 'level');
    for (const r of dash.disk?.data ?? []) push('supabase', 'disk_fs_used', dayOf(r.period_start), Math.round(Number(r.values?.disk_fs_used ?? r.disk_fs_used)), 'level');
  } else if (sql || proj) {
    const period = sql?.period ?? anchoredPeriod(process.env.SUPABASE_BILLING_ANCHOR_DAY);
    if (period.anchor === 'assumed') period.anchorNote = 'Billing anchors to your org creation day; set SUPABASE_BILLING_ANCHOR_DAY in .env';
    const reason = 'Not exposed to API tokens on Free; refresh with the dashboard capture';
    const metrics = [
      { key: 'database_size', label: 'Database size', used: Number(sql?.db_size?.[0]?.bytes), limit: 0.5 * GB, unit: 'bytes', resets: false, confidence: 'approximate', note: 'pg_database_size via SQL; the quota figure in the dashboard runs a little higher' },
      { key: 'storage_size', label: 'Storage size', used: Number(sql?.storage?.[0]?.bytes ?? 0), limit: 1 * GB, unit: 'bytes', resets: false, confidence: 'approximate', note: 'Sum of storage.objects metadata sizes' },
      { key: 'monthly_active_users', label: 'Monthly active users', used: Number(sql?.mau?.[0]?.mau ?? 0), limit: 50000, unit: 'count', resets: true, confidence: 'approximate', note: 'auth.users with last_sign_in_at in the period' },
      unavailable('egress', 'Egress', 'bytes', true, reason), unavailable('function_invocations', 'Edge function invocations', 'count', true, reason), unavailable('realtime_message_count', 'Realtime messages', 'count', true, reason), unavailable('log_ingestion', 'Log ingestion', 'bytes', true, reason),
    ].filter((m) => m.used === null || Number.isFinite(m.used));
    providers.push({ id: 'supabase', name: 'Supabase', account: where, plan: 'Free', source: 'official', auth: 'scoped personal access token (Management API SQL)', period, status, metrics });
  } else notes.push('supabase: no captures (run checks/supabase.mjs, then the dashboard capture for egress and friends)');
}

// ---------------- Vercel (dashboard capture preferred, official token gives plan + cycle only)
{
  const vd = load('vercel-dashboard'), team = load('vercel-team'), cycles = load('vercel-cycles');
  const plan = (team?.billing?.plan ?? 'hobby').replace(/^\w/, (c) => c.toUpperCase());
  const slug = vd?.teamSlug ?? team?.slug ?? 'team';
  const cyc = vd?.billingCycles?.current ?? cycles?.current;
  const period = cyc?.start ? { start: iso(cyc.start), end: iso(cyc.end), anchor: 'api' } : { ...calendarMonth(), anchorNote: 'Calendar month assumed; Hobby does not return a billing period' };
  // batchKey -> [metric key, label, unit, resets, limit override, note]
  const METERS = {
    'new-fast_data_transfer': ['fast_data_transfer', 'Fast data transfer', 'bytes', true], 'new-fast_origin_transfer': ['fast_origin_transfer', 'Fast origin transfer', 'bytes', true],
    'new-edge_requests': ['edge_requests', 'CDN requests', 'count', true], 'new-function_invocations': ['function_invocations', 'Function invocations', 'count', true],
    'new-fluid_cpu_duration': ['fluid_cpu_duration', 'Fluid active CPU', 'ms', true],
    'new-function_duration': ['function_duration', 'Function duration', 'gbh', true, 360, 'Raw dashboard unit unverified; shown against the documented 360 GB-hour Hobby limit'],
    'new-edge_request_cpu_duration': ['edge_request_cpu_duration', 'CDN request CPU', 'ms', true], 'new-image_transformations': ['image_transformations', 'Image transformations', 'count', true],
    'new-data_cache_reads': ['data_cache_reads', 'ISR reads', 'count', true], 'new-build_cpu': ['build_cpu', 'Build CPU time', 'ms', true, null, 'No Hobby cap on build time; 100 deployments/day'],
    'new-deployment_lambda_storage_size': ['deployment_lambda_storage_size', 'Functions storage', 'bytes', false], 'new-deployment_storage_size': ['deployment_storage_size', 'Deployment storage', 'bytes', false],
  };
  if (vd?.meters) {
    const metrics = [];
    for (const [bk, [key, label, unit, resets, limitOverride, note]] of Object.entries(METERS)) {
      const mt = vd.meters[bk]?.meter; if (!mt) continue;
      const scale = key === 'function_duration' && mt.limit ? 360 / mt.limit : 1; // TODO(verify) raw unit of function_duration
      metrics.push({ key, label, used: Number(mt.value ?? 0) * scale, limit: limitOverride !== undefined ? limitOverride : mt.limit, unit, resets, ...(note ? { note } : {}) });
      for (const d of vd.meters[bk].days ?? []) if (typeof d.sum === 'number') push('vercel', key, dayOf(d.date), d.sum * scale, resets ? 'delta' : 'level');
    }
    const resources = [...new Set(Object.values(vd.meters).flatMap((m) => m.resources ?? []))].filter((r) => typeof r === 'string' && !/^(prj|team|store)_/.test(r)).slice(0, 3);
    providers.push({ id: 'vercel', name: 'Vercel', account: `team ${slug}${resources.length ? `, project ${resources.join(', ')}` : ''}`, plan, source: 'dashboard', auth: 'dashboard session (server-rendered usage page); plan via API token', period, metrics });
  } else if (team) {
    const reason = 'Hobby has no usage API (billing/charges returns 404); refresh with the dashboard capture';
    providers.push({ id: 'vercel', name: 'Vercel', account: `team ${slug}`, plan, source: 'official', auth: 'team-scoped token', period, metrics: ['fast_data_transfer', 'edge_requests', 'function_invocations', 'fluid_cpu_duration', 'image_transformations'].map((k) => unavailable(k, METERS[`new-${k}`][1], METERS[`new-${k}`][2], true, reason)) });
  } else notes.push('vercel: no captures (run checks/vercel-token.mjs, then the dashboard capture for usage)');
}

// ---------------- Resend (official: GET /usage, since 2026-10-01)
{
  const u = load('resend-usage'), dom = load('resend-domains'), met = load('resend-metrics');
  if (u?.object === 'usage') {
    const monthEnd = u.emails?.monthly?.resets_at;
    const period = monthEnd ? { start: iso(Date.UTC(new Date(monthEnd).getUTCFullYear(), new Date(monthEnd).getUTCMonth() - 1, 1)), end: iso(monthEnd), anchor: 'api' } : calendarMonth();
    const q = (key, label, obj, resets, note) => obj && obj.used != null ? { key, label, used: Number(obj.used), limit: obj.limit == null ? null : Number(obj.limit), unit: 'count', resets, ...(note ? { note } : {}) } : null;
    const metrics = [
      q('emails_monthly', 'Emails this month', u.emails?.monthly, true, 'sent + received'),
      u.emails?.daily?.limit != null ? { ...q('emails_daily', 'Emails today (rolling 24 h)', u.emails.daily, true, `Sending pauses at the daily cap; resets ${String(u.emails.daily.resets_at).slice(0, 16).replace('T', ' ')} UTC`), period: { start: iso(new Date(u.emails.daily.resets_at).getTime() - 864e5), end: iso(u.emails.daily.resets_at), anchor: 'api' } } : null,
      q('contacts', 'Contacts', u.contacts, false),
      q('domains', 'Domains', u.domains, false),
      q('segments', 'Segments', u.segments, false),
      q('ai_credits', 'AI credits', u.ai_credits, true),
      u.automation_runs ? { ...q('automation_runs', 'Automation runs', u.automation_runs, true), period: u.automation_runs.resets_at ? { start: period.start, end: iso(u.automation_runs.resets_at), anchor: 'api' } : undefined } : null,
    ].filter(Boolean);
    const names = (dom?.domains ?? []).map((d) => d.name).filter(Boolean);
    providers.push({ id: 'resend', name: 'Resend', account: names.length ? names.join(', ') : 'team', plan: u.emails?.daily?.limit != null ? 'Free' : 'Paid', source: 'official', auth: 'API key (full access, see feasibility/resend.md)', period, metrics });
    for (const r of met?.data ?? []) push('resend', 'emails_monthly', String(r.period).slice(0, 10), Number(r.sent ?? 0) + Number(r.received ?? 0));
  } else notes.push('resend: no checks/out/resend-usage.json (run checks/resend.mjs)');
}

for (const n of notes) console.log('  ' + n);
if (!providers.length) { console.log('No provider data yet: nothing written, the dashboard keeps showing the bundled sample. Run `npm run check` first.'); process.exit(0); }
const project = process.env.FTM_PROJECT_NAME || load('supabase-projects')?.[0]?.name || 'my side project';
const data = { generatedAt: now.toISOString(), project, providers };
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/data.js`, `window.FTM_DATA = ${JSON.stringify(data, null, 2)};\n`);
writeFileSync(`${outDir}/series.js`, `window.FTM_SERIES = ${JSON.stringify(series)};\n`);
console.log(`wrote ${outDir}/data.js (${providers.length} providers, ${providers.reduce((a, p) => a + p.metrics.length, 0)} metrics) and series.js (${series.length} daily points)`);
for (const p of providers) console.log(`  ${p.name.padEnd(9)} ${p.source.padEnd(9)} ${p.metrics.length} metrics, ${p.metrics.filter((m) => m.used === null).length} unavailable`);
