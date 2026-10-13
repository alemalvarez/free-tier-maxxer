// Run this in a browser where you are logged in to https://supabase.com/dashboard (any dashboard page).
// It reuses the dashboard's own session token (from localStorage) to call the platform API the dashboard uses:
// org usage, subscription (real billing period), per-day usage, and the database size / disk history.
// The token is used only for these calls and is NOT included in the result. Nothing is sent anywhere except api.supabase.com.
// Result: a JSON object to save as checks/out/supabase-dashboard.json.
//
// Devtools console:   paste this file, then run
//   copy(JSON.stringify(await ftmSupabaseDashboard({ orgSlug: '<SUPABASE_ORG_SLUG>', projectRef: '<SUPABASE_PROJECT_REF>' })))
// Playwright / agent: evaluate the function body with the same arguments and write the returned object to the file.
async function ftmSupabaseDashboard({ orgSlug, projectRef } = {}) {
  const path = location.pathname;
  orgSlug = orgSlug || path.match(/\/dashboard\/org\/([^/]+)/)?.[1];
  projectRef = projectRef || path.match(/\/dashboard\/project\/([^/]+)/)?.[1];
  if (!orgSlug || !projectRef) throw new Error('pass { orgSlug, projectRef } (values from your .env)');
  let session = null;
  try { session = JSON.parse(localStorage.getItem('supabase.dashboard.auth.token') || 'null'); } catch {}
  const token = session?.access_token;
  if (!token) throw new Error('no dashboard session found in localStorage: log in to supabase.com/dashboard in this tab');
  if (session.expires_at && session.expires_at * 1000 < Date.now()) throw new Error('dashboard session expired: reload the dashboard page and run again');
  const B = 'https://api.supabase.com';
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  const get = async (url) => {
    const r = await fetch(url, { headers: h });
    const text = await r.text();
    let body = null; try { body = JSON.parse(text); } catch {}
    return { status: r.status, body: body ?? text.slice(0, 300) };
  };
  const end = new Date(), start = new Date(end.getTime() - 35 * 864e5);
  const infra = (attrs, interval) => get(`${B}/platform/projects/${projectRef}/infra-monitoring?attributes=${attrs}&interval=${interval}&startDate=${start.toISOString()}&endDate=${end.toISOString()}&databaseIdentifier=${projectRef}`);
  const [usage, subscription, daily, dbSize, disk] = await Promise.all([
    get(`${B}/platform/organizations/${orgSlug}/usage`),
    get(`${B}/platform/organizations/${orgSlug}/billing/subscription`),
    get(`${B}/platform/organizations/${orgSlug}/usage/daily?start=${start.toISOString()}&end=${end.toISOString()}`),
    infra('pg_database_size', '1d'),
    infra('disk_fs_used,disk_fs_size,disk_fs_used_wal,disk_fs_used_system', '1d'),
  ]);
  const statuses = { usage: usage.status, subscription: subscription.status, daily: daily.status, dbSize: dbSize.status, disk: disk.status };
  return { capturedAt: new Date().toISOString(), orgSlug, projectRef, statuses, usage: usage.body, subscription: subscription.body, daily: daily.body, dbSize: dbSize.body, disk: disk.body };
}
