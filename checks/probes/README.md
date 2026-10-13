Exploratory probes kept for the record. They were run once during the feasibility spike (dates in feasibility/*.md) and are not part of `npm run check`. Run one with `node --env-file=.env checks/probes/<name>.mjs`; output lands in checks/out/.

- vercel.mjs, vercel-probe.mjs, vercel-v1usage.mjs, vercel-unofficial.mjs: the Hobby billing endpoints that return 404 / plan_upgrade_required, and the token-accepting cycle endpoint.
- supabase-unofficial.mjs: proves the platform API rejects the `sbp_` token (session JWT only).
- alt-routes*.mjs: Vercel observability / analytics and Supabase analytics endpoints as approximations (see feasibility/alternative-routes.md).
