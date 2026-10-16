// Runs every official-API check whose env is present, in order, then the daily-series pull.
// Reads .env itself (no values are printed). Placeholder values from .env.example (ending in "...") count as empty.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const envFile = new URL('../.env', import.meta.url);
if (!existsSync(envFile)) { console.log('No .env found. Run: cp .env.example .env && chmod 600 .env, then paste your read-only tokens.'); process.exit(1); }
const env = { ...process.env };
for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue;
  const v = m[2].replace(/^["']|["']$/g, '');
  if (v && !v.endsWith('...')) env[m[1]] = v;
}
const scripts = ['github', 'posthog', 'langfuse', 'supabase', 'vercel-token', 'resend', 'series-api'];
const results = {};
for (const s of scripts) {
  console.log(`\n=== checks/${s}.mjs`);
  const r = spawnSync(process.execPath, [new URL(`./${s}.mjs`, import.meta.url).pathname], { stdio: 'inherit', env });
  results[s] = r.status === 0 ? 'ok' : r.status === 2 ? 'skipped (env empty)' : `failed (exit ${r.status})`;
}
console.log('\nSummary:');
for (const [s, v] of Object.entries(results)) console.log(`  ${s.padEnd(14)} ${v}`);
console.log('\nNext: npm run build && npm run serve');
