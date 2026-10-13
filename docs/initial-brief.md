# free-tier-maxer — project init brief

You are initializing a new open-source repository called **free-tier-maxer**. Read this whole brief before writing code. When something here is uncertain (especially provider APIs), verify it against official docs; never invent endpoints, fields or limits. If you cannot verify something, leave a clearly marked `TODO(verify)` instead of guessing.

## 1. What it is

A local-first, self-hosted tool that shows developers how much of their **free tiers** they've used across the services behind their side projects, and warns them before they hit a limit.

- One dashboard for all providers (no provider offers a cross-service view).
- Usage vs. limit, time left in the billing period, and a projection ("at this rate you'll hit Supabase egress on day 22").
- **API keys never leave the user's machine.** No hosted backend, no telemetry.
- Tone: helpful with a bit of humor. Alerts can be snarky ("PostHog at 87%. Maybe stop refreshing your own landing page.").

Initial providers: **GitHub, PostHog, Langfuse** (cleanest APIs, build first), then **Supabase**, then **Vercel** (riskiest: usage/billing APIs may be limited or unavailable on the Hobby plan).

## 2. Principles (non-negotiable)

1. **Local-first.** Everything runs on the user's machine. The only network calls are to provider APIs.
2. **Read-only.** Adapters only read usage. Document the minimum token scope needed per provider.
3. **No secret leakage.** Never log, print, snapshot or commit tokens. Redact in errors.
4. **Graceful partial data.** If a provider can't report a metric, show it as `unavailable` with a reason; never fake a number.
5. **Limits are data, not code.** Free-tier limits live in a versioned YAML file anyone can PR.

## 3. Tech stack

- **Language:** TypeScript (strict), Node.js ≥ 20.
- **Package manager:** pnpm workspaces (monorepo).
- **Storage:** local SQLite file (e.g. `better-sqlite3`), default path `~/.free-tier-maxer/data.db`.
- **CLI:** a small CLI framework (e.g. `commander` or `citty`).
- **Dashboard:** Vite + React SPA, built to static files and served locally by the CLI.
- **MCP server:** official MCP TypeScript SDK, stdio transport.
- **Testing:** Vitest. Tests must not hit real provider APIs; use recorded fixtures.
- **Lint/format:** ESLint + Prettier (or Biome). CI on GitHub Actions: lint, typecheck, test.
- **License:** MIT.

## 4. Repository layout

```
free-tier-maxer/
├─ packages/
│  ├─ core/          # adapters, limits loader, snapshot store, projections, alert logic
│  ├─ cli/           # `ftm` binary: status, check, snapshot, serve, mcp, init
│  ├─ dashboard/     # Vite + React UI, reads from a local JSON API exposed by `ftm serve`
│  └─ mcp/           # MCP server exposing usage tools (thin wrapper over core)
├─ limits/
│  └─ limits.yaml    # free-tier limits per provider/plan
├─ examples/
│  ├─ config.example.toml
│  └─ github-action-cron.yml   # optional: run snapshots on a schedule
├─ docs/
│  └─ providers/<provider>.md  # token scopes, what's supported, known gaps
├─ README.md
├─ CONTRIBUTING.md   # how to add a provider adapter / update limits
└─ LICENSE

```

## 5. Core concepts

### Adapter interface

Each provider is an adapter implementing:

```ts
export interface ProviderAdapter {
  id: string;                       // "github", "posthog", ...
  displayName: string;
  configSchema: ZodSchema;          // token, org/project ids, region/host, etc.
  fetchUsage(cfg: unknown, ctx: FetchContext): Promise<UsageReading[]>;
}

export interface UsageReading {
  provider: string;                 // "supabase"
  account: string;                  // org/team/project label (supports multiple accounts)
  metric: string;                   // "db_size", "egress", "events", "actions_minutes"
  unit: "bytes" | "count" | "minutes" | "hours" | "units";
  used: number | null;              // null => unavailable
  unavailableReason?: string;
  periodStart?: string;             // ISO
  periodEnd?: string;               // ISO; required for projections
  fetchedAt: string;                // ISO
}

```

Core joins readings with `limits.yaml` to compute `% used`, `days left`, and a linear projection to period end.

### limits.yaml

```yaml
supabase:
  free:
    db_size:        { limit: 500, unit: MB,  period: none,    source: "https://supabase.com/pricing", verified_at: TODO }
    egress:         { limit: 5,   unit: GB,  period: billing, source: "https://supabase.com/pricing", verified_at: TODO }
    cached_egress:  { limit: 5,   unit: GB,  period: billing, source: "https://supabase.com/pricing", verified_at: TODO }
    storage_size:   { limit: 1,   unit: GB,  period: none,    source: "https://supabase.com/pricing", verified_at: TODO }
    mau:            { limit: 50000, unit: count, period: billing, source: "https://supabase.com/pricing", verified_at: TODO }

```

Every entry needs `source` (official pricing URL) and `verified_at`. Seed values for all five providers, but treat them as unverified until checked against each provider's official pricing page. Notes from prior research, all to be re-verified:

- **Supabase Free:** 500 MB DB, 5 GB egress, 5 GB cached egress, 1 GB storage, 50k MAU, 2 active projects, projects pause after ~1 week of inactivity.
- **Vercel Hobby:** ~100 GB bandwidth, ~1M function invocations, plus CPU/compute limits (check current names and numbers).
- **PostHog Free:** ~1M analytics events/month, ~5k recordings, ~1M feature-flag requests.
- **Langfuse Cloud Hobby:** monthly "units" cap. Check the current number.
- **GitHub Free:** Actions minutes for private repos, Packages storage. Check the current numbers.

### Config

`~/.free-tier-maxer/config.toml` (path overridable). Tokens can be given inline or, preferably, as env var references (`token_env = "POSTHOG_API_KEY"`). Support multiple accounts per provider. `ftm init` writes a commented example and sets file permissions to 600.

## 6. CLI commands


| Command                         | Behavior                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `ftm init`                      | Create config + data dir, print next steps.                                                          |
| `ftm status`                    | Fetch now, print a colored table: provider, account, metric, used/limit, %, period ends, projection. |
| `ftm snapshot`                  | Fetch and store a reading in SQLite (for cron/daemon use).                                           |
| `ftm check --warn 70 --fail 90` | Exit non-zero past thresholds or if projected to exceed. Optional Slack webhook / stdout message.    |
| `ftm serve [--port 4321]`       | Serve the dashboard + local JSON API on `127.0.0.1` only.                                            |
| `ftm mcp`                       | Start the MCP server over stdio.                                                                     |


Also support `--json` output on `status` and `check`.

## 7. Dashboard (v1)

- Cards per provider/account with usage bars (green &lt; 70%, amber &lt; 90%, red ≥ 90%).
- Countdown to period reset; projection badge ("will exceed in ~6 days").
- History chart per metric from snapshots.
- "Unavailable" state with the reason and a link to `docs/providers/<id>.md`.
- Light/dark mode. Binds to localhost only.

## 8. MCP tools (v1)

- `get_usage` (optional provider filter) → current readings with % and projections.
- `closest_to_limit` → top N metrics by % used or soonest projected breach.
- `list_providers` → configured providers and their status.

## 9. Provider notes

All endpoints below must be verified against official docs before implementation.

- **GitHub:** billing usage API (enhanced billing platform) for Actions minutes and Packages/storage. Fine-grained token with the minimum billing read permission.
- **PostHog:** count events in the current billing period via the query API (HogQL), and/or org billing endpoints. Personal API key with read scopes. Support US/EU/self-hosted host.
- **Langfuse:** public API metrics / observation counts to approximate billable units. Public + secret key. Support cloud region host.
- **Supabase:** Management API for org/project info; DB size via SQL (`pg_database_size`) if the user provides a DB connection; storage via the Storage API. Egress may be unavailable; mark it so. Bonus: warn when a free project is near auto-pause from inactivity.
- **Vercel:** check whether usage or billing endpoints work on Hobby. If not, ship a partial adapter (whatever is readable) and document the gap clearly.

## 10. Scope of THIS init task

Do:

1. Scaffold the monorepo, tooling, CI, license, README skeleton (with the pitch and a "your keys never leave your machine" section), and CONTRIBUTING.
2. Implement `core`: types, adapter registry, limits loader + schema validation, SQLite snapshot store, projection math, threshold logic, with unit tests.
3. Implement a **mock adapter** with fixtures so `ftm status`, `ftm check` and `ftm serve` work end-to-end with no credentials.
4. Implement the **GitHub adapter** as the reference real adapter, if its API can be verified; otherwise leave a typed stub with `TODO(verify)`.
5. Create stub adapters (typed, registered, returning `unavailable`) for PostHog, Langfuse, Supabase and Vercel, plus a `docs/providers/*.md` for each.
6. Seed `limits/limits.yaml` for all five providers with `source` URLs and `verified_at: TODO`.
7. Minimal dashboard that renders cards + bars from the mock adapter.

Don't (yet): landing page, OS keychain integration, Docker image, daemon mode, packaging as a single binary, publishing to npm.

## 11. Acceptance criteria

- `pnpm install && pnpm build && pnpm test` pass from a clean clone.
- `pnpm ftm status` with the mock provider prints a table with %, period end and projection.
- `pnpm ftm check --fail 90` exits non-zero when a mock metric is ≥ 90%.
- `pnpm ftm serve` opens a working dashboard on `127.0.0.1`.
- `pnpm ftm mcp` starts and lists the three tools.
- No tokens appear in logs, snapshots, fixtures or test output.
- Every unverified API or limit is marked `TODO(verify)`.

When done, report: what was built, what was verified vs. left as `TODO(verify)`, and suggested next steps (likely the PostHog and Langfuse adapters).