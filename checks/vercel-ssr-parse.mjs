// Parses the server-rendered Vercel usage page (https://vercel.com/<team>/~/usage) into meters + daily series.
// The page embeds every usage card's data in self.__next_f.push chunks: per card a "batchKey" followed by
// "initialData": { "meterData": {limit, value, ...}, "data": { "data": [ {date, sum, ...}, ... ] } }.
// Usage:  node checks/vercel-ssr-parse.mjs <saved-page.html> [team-slug]   -> writes checks/out/vercel-dashboard.json
// Keep the extraction logic in sync with checks/browser/vercel-usage.js (same algorithm, runs in the browser).
import { readFileSync } from 'node:fs';
import { save } from './_lib.mjs';

export function parseVercelUsage(rawHtml) {
  const t = rawHtml.replace(/\\"/g, '"');
  const balanced = (s, i) => {
    let depth = 0, inStr = false;
    for (let j = i; j < s.length; j++) {
      const ch = s[j];
      if (inStr) { if (ch === '\\') j++; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true;
      else if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') { depth--; if (depth === 0) return s.slice(i, j + 1); }
    }
    return null;
  };
  const meters = {};
  const re = /"batchKey":"([^"]+)"/g;
  let m;
  while ((m = re.exec(t))) {
    const key = m[1];
    const idx = t.indexOf('"initialData":', m.index);
    if (idx < 0 || idx - m.index > 20000) continue;
    const objStr = balanced(t, t.indexOf('{', idx));
    if (!objStr) continue;
    try {
      const obj = JSON.parse(objStr.replace(/"\$undefined"/g, 'null'));
      const rows = obj?.data?.data ?? [];
      meters[key] = {
        meter: obj.meterData ?? null,
        days: rows.map((x) => ({ date: x.date, sum: x.sum })),
        resources: rows[0]?.resources?.map((x) => x.name ?? x.id ?? null).filter(Boolean) ?? [],
      };
    } catch (e) {
      meters[key] = { error: String(e).slice(0, 120) };
    }
  }
  const bc = t.match(/"billingCycles":(\{"current":\{[^}]*\},"previous":\{[^}]*\}\})/);
  return { billingCycles: bc ? JSON.parse(bc[1]) : null, meters };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const [file, teamSlug] = process.argv.slice(2);
  if (!file) { console.log('usage: node checks/vercel-ssr-parse.mjs <saved-page.html> [team-slug]'); process.exit(1); }
  const parsed = parseVercelUsage(readFileSync(file, 'utf8'));
  const n = Object.keys(parsed.meters).length;
  if (!n) { console.log('no meters found: is this the full HTML of vercel.com/<team>/~/usage while logged in?'); process.exit(1); }
  save('vercel-dashboard', { capturedAt: new Date().toISOString(), teamSlug: teamSlug ?? null, ...parsed });
  console.log(`parsed ${n} meters, billing cycle ${parsed.billingCycles ? 'found' : 'missing'} -> checks/out/vercel-dashboard.json`);
}
