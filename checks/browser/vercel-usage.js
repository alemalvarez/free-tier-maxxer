// Run this in a browser where you are logged in to vercel.com, on any page of your team (e.g. https://vercel.com/<team>/~/usage).
// It re-fetches the server-rendered usage page with your session cookie and extracts every usage meter plus the
// billing cycle. Nothing is sent anywhere except vercel.com. Result: a JSON object to save as checks/out/vercel-dashboard.json.
//
// Devtools console:   paste this file, then run   copy(JSON.stringify(await ftmVercelUsage()))   and paste into the file.
// Playwright / agent: evaluate the function body and write the returned object to checks/out/vercel-dashboard.json.
// Keep the extraction logic in sync with checks/vercel-ssr-parse.mjs.
async function ftmVercelUsage(teamSlug) {
  const slug = teamSlug || location.pathname.split('/').filter(Boolean)[0];
  if (!slug) throw new Error('open a page under https://vercel.com/<team>/ first, or pass the team slug');
  const r = await fetch(`/${slug}/~/usage`, { credentials: 'include', headers: { accept: 'text/html' } });
  if (r.status !== 200) throw new Error(`usage page returned ${r.status}: are you logged in and is "${slug}" your team slug?`);
  const t = (await r.text()).replace(/\\"/g, '"');
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
      meters[key] = { meter: obj.meterData ?? null, days: rows.map((x) => ({ date: x.date, sum: x.sum })), resources: rows[0]?.resources?.map((x) => x.name ?? x.id ?? null).filter(Boolean) ?? [] };
    } catch (e) { meters[key] = { error: String(e).slice(0, 120) }; }
  }
  const bc = t.match(/"billingCycles":(\{"current":\{[^}]*\},"previous":\{[^}]*\}\})/);
  return { capturedAt: new Date().toISOString(), teamSlug: slug, billingCycles: bc ? JSON.parse(bc[1]) : null, meters };
}
