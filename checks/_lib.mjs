// Shared helpers for the feasibility checks. Never prints headers or secrets.
// Any env value >= 8 chars whose name contains TOKEN, KEY or SECRET is scrubbed from everything we print or save.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';

const SECRETS = Object.entries(process.env)
  .filter(([k, v]) => /TOKEN|KEY|SECRET/.test(k) && v && v.length >= 8)
  .map(([, v]) => v);

export function scrub(s) {
  let out = typeof s === 'string' ? s : JSON.stringify(s, null, 2);
  for (const v of SECRETS) out = out.split(v).join('<REDACTED>');
  return out;
}

export async function req(label, url, init = {}) {
  const t0 = Date.now();
  let res, text;
  try {
    res = await fetch(url, init);
    text = await res.text();
  } catch (e) {
    console.log(`[${label}] NETWORK ERROR ${scrub(String(e.message))}`);
    return { status: 0, body: null, text: '' };
  }
  let body = null;
  try { body = JSON.parse(text); } catch { body = null; }
  const safeUrl = url.replace(/([?&](teamId|token)=)[^&]+/g, '$1<x>');
  console.log(`[${label}] ${init.method ?? 'GET'} ${safeUrl} -> ${res.status} (${Date.now() - t0}ms, ${text.length}b)`);
  return { status: res.status, body, text };
}

const OUT = new URL('./out/', import.meta.url);
export function save(name, data) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL(`${name}.json`, OUT), scrub(data) + '\n');
}
export function load(name) {
  const p = new URL(`${name}.json`, OUT);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

export function need(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) { console.log(`MISSING env: ${missing.join(', ')} (skipping)`); process.exit(2); }
}

export const now = new Date().toISOString();
const iso = (ms) => new Date(ms).toISOString();

// UTC calendar month containing "now".
export function calendarMonth() {
  const d = new Date(), y = d.getUTCFullYear(), m = d.getUTCMonth();
  return { start: iso(Date.UTC(y, m, 1)), end: iso(Date.UTC(y, m + 1, 1)), anchor: 'assumed' };
}

// Billing period anchored on a day of the month (e.g. the day the org was created). Day is clamped to the month length.
export function anchoredPeriod(anchorDay) {
  const day = Number(anchorDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) return calendarMonth();
  const d = new Date(), y = d.getUTCFullYear(), m = d.getUTCMonth();
  const clamp = (yy, mm) => Math.min(day, new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate());
  let start = Date.UTC(y, m, clamp(y, m));
  if (start > d.getTime()) start = Date.UTC(y, m - 1, clamp(y, m - 1));
  const s = new Date(start);
  const end = Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, clamp(s.getUTCFullYear(), s.getUTCMonth() + 1));
  return { start: iso(start), end: iso(end), anchor: 'config', anchorNote: `Anchored on day ${day} of the month from your .env; the API does not expose it` };
}

export const monthStart = calendarMonth().start;
