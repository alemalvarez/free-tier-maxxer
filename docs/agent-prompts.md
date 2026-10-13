# Prompts for coding agents

Copy one of these into Claude Code, Codex, Cursor, Copilot or any agent that can run commands in this repo. The agent reads `AGENTS.md` for the rules. You stay in charge of logging in and pasting tokens; the agent never needs to see a token.

## Set up

```
Set up free-tier-maxxer for my side project.
Read README.md and AGENTS.md in this repo first.
1. Create .env from .env.example (chmod 600). Ask me which of GitHub, PostHog, Langfuse, Supabase and Vercel I use.
2. For each one, tell me exactly which token to create (where, which read-only scopes, which .env variables). I will paste the values into .env myself; never ask me to paste a token into the chat and never print one.
3. When I say .env is ready, verify the variables are non-empty without showing values, then run `npm run check` and explain any failures (which provider, which scope).
4. If I use Vercel or Supabase, do the dashboard capture described in README ("Vercel and Supabase: the dashboard capture"). If you have a browser tool, open the login page, wait for me to log in, run the function from checks/browser/, and save the result to checks/out/. If you don't, give me the devtools steps and wait for the file.
5. Run `npm run build` and `npm run serve`, then tell me what to open and summarize what is live, what is unavailable and why, and what runs out first.
```

## Refresh Vercel

```
Refresh the Vercel numbers for free-tier-maxxer.
Read AGENTS.md. In a browser where I am logged in to vercel.com, open https://vercel.com/<my-team>/~/usage (ask me for the team slug if you don't know it), evaluate the function in checks/browser/vercel-usage.js, and save the returned object as JSON to checks/out/vercel-dashboard.json. Then run `npm run build` and confirm Vercel shows source "dashboard" with a current billing cycle. If you have no browser tool, give me the four devtools steps from README and wait for the file.
```

## Refresh Supabase

```
Refresh the Supabase numbers for free-tier-maxxer.
Read AGENTS.md. In a browser where I am logged in to supabase.com/dashboard, evaluate the function in checks/browser/supabase-dashboard.js with { orgSlug, projectRef } taken from SUPABASE_ORG_SLUG and SUPABASE_PROJECT_REF in .env (identifiers, not secrets; do not read other variables), and save the returned object as JSON to checks/out/supabase-dashboard.json. If it says the session expired, reload the dashboard and retry once. Then run `npm run build` and confirm Supabase shows source "dashboard" with the real billing period. If you have no browser tool, give me the four devtools steps from README and wait for the file.
```

## Re-check everything

```
Run `npm run check` then `npm run build` in this repo (read AGENTS.md first), and tell me which providers refreshed, which were skipped, and whether anything is projected to hit its limit before the period ends.
```
