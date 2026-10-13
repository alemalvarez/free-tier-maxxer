import { req, save, need, scrub, monthStart, now } from './_lib.mjs';
need('POSTHOG_API_KEY', 'POSTHOG_HOST', 'POSTHOG_PROJECT_ID');
const H = process.env.POSTHOG_HOST.replace(/\/$/, '');
const h = { Authorization: `Bearer ${process.env.POSTHOG_API_KEY}`, 'Content-Type': 'application/json' };

const billing = await req('billing', `${H}/api/billing/`, { headers: h });
save('posthog-billing', billing.body ?? billing.text);
const b = billing.body;
if (b && typeof b === 'object') {
  console.log('top keys:', Object.keys(b).join(', '));
  console.log('subscription_level:', b.subscription_level, '| has_active_subscription:', b.has_active_subscription);
  console.log('billing_period:', scrub(b.billing_period ?? null));
  console.log('usage_summary:', scrub(b.usage_summary ?? null));
  for (const p of b.products ?? []) {
    console.log(`product ${p.type} | usage_key=${p.usage_key} | current_usage=${p.current_usage} | usage_limit=${p.usage_limit} | free_allocation=${p.free_allocation} | pct=${p.percentage_usage} | unit=${p.unit}`);
  }
} else console.log('billing body:', scrub(billing.text).slice(0, 600));

const usageTs = await req('billing/usage', `${H}/api/billing/usage/?start_date=${monthStart.slice(0,10)}&end_date=${now.slice(0,10)}&interval=day`, { headers: h });
save('posthog-billing-usage', usageTs.body ?? usageTs.text);
console.log('billing/usage keys:', usageTs.body && typeof usageTs.body === 'object' ? Object.keys(usageTs.body).join(', ') : scrub(usageTs.text).slice(0, 300));

const q = await req('hogql', `${H}/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`, {
  method: 'POST', headers: h,
  body: JSON.stringify({ query: { kind: 'HogQLQuery', query: `SELECT count() FROM events WHERE timestamp >= toDateTime('${monthStart.slice(0,19)}')` } }),
});
save('posthog-hogql', q.body ?? q.text);
console.log('hogql result:', scrub(q.body?.results ?? q.body?.error ?? q.text).slice(0, 300));
