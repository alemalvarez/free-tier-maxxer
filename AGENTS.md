# Instructions for coding agents working in this repository

free-tier-maxxer shows free-tier usage against limits for GitHub, PostHog, Langfuse, Supabase, Vercel and Resend. This repo is the exploration stage: feasibility research, check scripts and a concept dashboard. The product brief for the real tool is `docs/initial-brief.md`. Read `README.md` first.

## Rules that always apply

1. **Never print, log, echo or write a token.** Tokens live only in `.env`. `checks/_lib.mjs` scrubs any env value named `*TOKEN*`, `*KEY*` or `*SECRET*` from saved output; keep every new script on that helper. Do not read `.env` into a reply. Do not run `cat .env`, `env`, `printenv` or `set` in a way that shows values; use `rg -c` or check that a variable is non-empty.
2. **Never commit `.env` or `checks/out/`.** Both are git-ignored. Captures contain account ids, project names and usage rows.
3. **Read-only everywhere.** Only GET requests and read-only SQL against providers. If a route would need a write scope, stop and say so.
4. **Never invent provider facts.** Endpoints, fields, limits and scopes come from `feasibility/*.md` (verified live, dates included) or from a live call you make now. Anything you cannot verify is written as `TODO(verify)`, never as a number.
5. **Partial data is fine, fake data is not.** A metric a route cannot report is `used: null` with an `unavailable` reason.
6. **Nothing leaves the machine** except calls to the providers' own hosts. No telemetry, no third-party services.
7. The user does the logging in. When a browser tool is involved, navigate to the login page and wait for the user; never ask for a password or 2FA code.

## Commands

| Task | Command |
|---|---|
| Pull usage from every configured provider | `npm run check` (or `npm run check:<provider>`) |
| Build dashboard data from the captures | `npm run build` |
| Serve the dashboard on 127.0.0.1:4321 | `npm run serve` |
| Parse a saved Vercel usage page | `npm run vercel:parse -- page.html <team-slug>` |

All scripts run with plain Node 20.6+ and have no dependencies. Check scripts exit with code 2 when their env is missing; that is a skip, not a failure.

## Workflows

**First setup for a user** — follow `docs/agent-prompts.md` "Set up". In short: copy `.env.example` to `.env`, tell the user which tokens to create and with which scopes (the table in README), ask them to paste the values themselves, run `npm run check`, then the dashboard captures if a browser tool is available, then `npm run build` and `npm run serve`.

**Refresh Vercel or Supabase** — the dashboard providers. With a browser tool (Playwright MCP or similar): open the provider in a tab the user is logged in to, evaluate the function in `checks/browser/vercel-usage.js` or `checks/browser/supabase-dashboard.js`, write the returned object to `checks/out/vercel-dashboard.json` or `checks/out/supabase-dashboard.json` with a file-writing tool, run `npm run build`. Without a browser tool: give the user the four devtools steps from README and wait for the file.

**Adding a provider check** — create `checks/<provider>.mjs` using `req`, `save`, `need` from `_lib.mjs`; document the token scope in `.env.example`; write what you verified, with the date, in `feasibility/<provider>.md`; map the capture into `checks/build-concept.mjs`.

## Layout

- `checks/` scripts, `checks/out/` captures (ignored), `checks/browser/` in-browser functions
- `concept/index.html` the dashboard; `concept/data.js` and `concept/series.js` are built outputs (ignored); `concept/sample/` is the committed sample
- `feasibility/` research; `docs/` brief and prompts; `.claude/skills/free-tier-maxxer/` the Claude Code skill
