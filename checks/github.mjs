import { req, save, need, scrub } from './_lib.mjs';
need('GITHUB_TOKEN', 'GITHUB_USERNAME');
const u = process.env.GITHUB_USERNAME;
const h = { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
const y = new Date().getUTCFullYear(), m = new Date().getUTCMonth() + 1;

const usage = await req('usage', `https://api.github.com/users/${u}/settings/billing/usage?year=${y}&month=${m}`, { headers: h });
save('github-usage', usage.body ?? usage.text);
const summary = await req('summary', `https://api.github.com/users/${u}/settings/billing/usage/summary?year=${y}&month=${m}`, { headers: h });
save('github-summary', summary.body ?? summary.text);

if (usage.body?.usageItems) {
  const rows = usage.body.usageItems.map((i) => `${i.product} | ${i.sku} | ${i.quantity} ${i.unitType} | gross ${i.grossAmount} disc ${i.discountAmount} net ${i.netAmount} | ${i.repositoryName ?? ''}`);
  console.log(`usageItems: ${rows.length}`); console.log(rows.slice(0, 40).join('\n'));
} else {
  console.log('usage body:', scrub(usage.body ?? usage.text).slice(0, 600));
}
if (summary.body) console.log('summary keys:', Object.keys(summary.body).join(', '), '\n', scrub(summary.body).slice(0, 1200));
