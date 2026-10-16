---
name: free-tier-maxxer
description: Set up free-tier-maxxer for the user's own accounts (tokens, checks, dashboard) or refresh the Vercel and Supabase dashboard captures. Use when the user asks to set up, configure, check providers, pull usage, or refresh Vercel or Supabase numbers.
---

# free-tier-maxxer setup and refresh

Read `AGENTS.md` first. Never print token values. The user pastes tokens into `.env` themselves.

Arguments: none for a full setup; `refresh vercel`, `refresh supabase` or `refresh` for the dashboard captures only; `check` to re-run the API checks and rebuild.

## Setup

1. Confirm Node 20.6+ (`node --version`). If `.env` is missing, copy `.env.example` to `.env` and `chmod 600 .env`.
2. Ask the user which of the six providers their project uses. For each one, give them the token recipe from the README table (where to create it, exact scopes, which `.env` variables to fill) and tell them to leave unused providers empty. Wait until they say the values are in `.env`.
3. Verify presence without revealing values, for example `rg -c '^GITHUB_TOKEN=.+' .env`. Placeholder values such as `github_pat_...` count as missing; say so.
4. Run `npm run check`. Read the summary at the end. For a 401 or 403, name the provider and the scope from the README table and ask the user to fix the token. Exit code 2 from a script means its env is empty, which is expected for unused providers.
5. If the user uses Vercel or Supabase, do the dashboard capture (next section).
6. Run `npm run build`, then `npm run serve` in the background, and tell the user to open http://127.0.0.1:4321. Summarize which providers are live, which metrics are unavailable and why, and the top of the "what runs out first" list.

## Dashboard captures (Vercel, Supabase)

These need a logged-in browser. Check whether a browser tool is available (Playwright MCP tools such as `browser_navigate` and `browser_evaluate`).

With a browser tool:

1. Navigate to `https://vercel.com/login` or `https://supabase.com/dashboard`. Ask the user to log in in that browser window and tell you when done. Never handle credentials or 2FA.
2. Vercel: navigate to `https://vercel.com/<team-slug>/~/usage` (the slug is the first path segment on their team pages; ask if unknown). Evaluate the body of `ftmVercelUsage` from `checks/browser/vercel-usage.js` as an async function and capture the returned object.
3. Supabase: evaluate the body of `ftmSupabaseDashboard` from `checks/browser/supabase-dashboard.js` with `{ orgSlug, projectRef }` taken from the names in `.env` (read only those two variables; they are identifiers, not secrets). If it throws "session expired", reload the dashboard tab and try once more.
4. Write the returned object, as JSON, to `checks/out/vercel-dashboard.json` or `checks/out/supabase-dashboard.json`. If the tool returned the object truncated, re-run the evaluation returning `JSON.stringify(result)` and write that string.
5. Run `npm run build` and confirm the provider now shows `dashboard` as its source in the build output.

Without a browser tool: give the user the four devtools steps from the README section "Vercel and Supabase: the dashboard capture" and wait for them to confirm the file exists, then build.

## Done

End with: providers live, providers skipped, metrics unavailable with reasons, and any `TODO(verify)` you hit. Remind the user that the dashboard captures are snapshots and can be refreshed with `/free-tier-maxxer refresh`.
