---
project: Assessly
researched_at: 2026-05-20
recommended_platform: Cloudflare Workers + Pages
runner_up: Render
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6
  runtime: Cloudflare Workers (V8 isolates)
---

## Recommendation

**Deploy on Cloudflare Workers + Pages.**

Cloudflare is the only platform that scores Pass on all five agent-friendly criteria: full CLI-first operations via wrangler, fully managed serverless execution, agent-readable docs with a published `llms.txt`, deterministic one-command deploys with programmatic rollbacks, and an official MCP server. The project's tech stack already targets `cloudflare-pages` with the `@astrojs/cloudflare` adapter — zero adapter change required. The free tier covers 100,000 requests/day with unlimited static asset serving, satisfying the cost-minimization constraint for an MVP with low traffic.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Total |
|---|---|---|---|---|---|---|
| **Cloudflare** | Pass | Pass | Pass | Pass | Pass | **10/10** |
| **Vercel** | Pass | Pass | Partial | Pass | Partial | **8/10** |
| **Railway** | Pass | Partial | Partial | Pass | Pass | **8/10** |
| **Render** | Pass | Partial | Partial | Pass | Pass | **8/10** |
| **Fly.io** | Pass | Partial | Partial | Pass | Fail | **6/10** |
| **Netlify** | Partial | Pass | Fail | Partial | Partial | **5/10** |

### Shortlisted Platforms

#### 1. Cloudflare Workers + Pages (Recommended)

Native fit for the existing tech stack (`@astrojs/cloudflare` adapter already configured, `deployment_target: cloudflare-pages` in tech-stack.md). Perfect score across all five criteria. The generous free tier (100k requests/day, unlimited static assets) covers MVP traffic with zero cost. Wrangler CLI provides deploy, rollback, log tailing, and secret management — all scriptable. Official MCP server enables AI agents to manage Workers, KV, D1, and R2 programmatically. Published `llms.txt` at `developers.cloudflare.com/workers/llms.txt` gives agents direct access to documentation.

#### 2. Render

Free tier web service ($0/mo, 512MB RAM) sufficient for MVP traffic. Full CLI with deploy, rollback, and SSH access. Published agent skills (`render skills install`) provide structured AI coding tool integration for Claude Code, OpenCode, and Cursor. Co-located Postgres and Redis available. Main gap: requires switching to `@astrojs/node` adapter, free tier has 30s cold starts after inactivity, and the platform runs containers (more operational surface than serverless).

#### 3. Railway

Best-in-class MCP server (`@railway/mcp-server`) with install command built into the CLI (`railway mcp install`). Excellent DX with one-command deploys, live log streaming, and co-located databases. Documentation source available as markdown on GitHub. Main gaps: $5/mo minimum cost (no permanent free tier), requires `@astrojs/node` adapter, and container-based (more operational surface).

## Anti-Bias Cross-Check: Cloudflare Workers + Pages

### Devil's Advocate — Weaknesses

1. **Non-standard runtime**: Workers uses V8 isolates, not Node.js. npm packages depending on Node.js built-ins (`fs`, `net`, `child_process`) won't work even with `nodejs_compat`. Future dependency additions may be blocked.
2. **CPU time limits**: Free tier gives 10ms CPU/request. AI recommendation calls with processing overhead could exceed this, forcing the $5/mo paid plan sooner than expected.
3. **No native image processing**: `sharp` doesn't run on Workers. Book cover manipulation requires Cloudflare Images (separate paid service) or build-time-only optimization.
4. **Local dev discrepancies**: `wrangler dev` (Miniflare) approximates but doesn't perfectly replicate Workers runtime. Subtle binding behavior differences cause "works locally, breaks in prod" issues.
5. **Vendor lock-in via bindings**: Using D1/KV/R2 through `platform.env` makes migration away from Cloudflare require rewriting all data access code.

### Pre-Mortem — How This Could Fail

The team deployed their Astro 6 recruitment evaluation app on Cloudflare Pages. Initially everything worked — static pages were fast, the free tier was generous. Then they integrated an AI evaluation engine for scoring CVs against job descriptions. The OpenAI SDK worked, but response streaming hit edge cases with Workers' streaming implementation. They added Supabase for auth and data, which worked fine — but when they wanted to add a background job to periodically reprocess evaluations with updated models, they discovered Workers can't run background processes. They tried Cloudflare Queues, but the complexity of queue consumers for a solo developer was disproportionate. The 10ms CPU limit on the free tier forced them to the $5/mo plan sooner than expected. Six months in, they wanted to add PDF CV parsing requiring a Node.js-only library, and discovered it was impossible on Workers. They faced a choice: rewrite for Node.js on another platform, or maintain a hybrid architecture with a separate Node.js service. The "free and simple" decision had accumulated enough friction to slow iteration to a crawl.

### Unknown Unknowns

- **Supabase client compatibility**: `@supabase/supabase-js` works on Workers, but realtime subscriptions and local file uploads via `fs` don't. Auth and query patterns must stay within Workers runtime limits.
- **Preview URL protection**: Cloudflare Pages preview URLs are publicly accessible by default. Protecting them requires setting up Cloudflare Access (separate configuration), unlike Vercel/Netlify where previews are semi-private.
- **Wrangler/adapter version coupling**: `@astrojs/cloudflare` and `wrangler` evolve on different release cycles. Breaking changes in wrangler's local dev mode have historically broken Astro's dev experience temporarily.
- **No built-in APM**: Workers Analytics is basic (request counts, error rates). APM-level observability requires third-party tools (Sentry, Baselime) adding complexity and cost.
- **`astro dev` sufficiency**: With Astro 6, `astro dev` provides adequate local runtime fidelity for development. `wrangler pages dev` is only needed to test Cloudflare-specific bindings (D1, KV, R2). Tutorials suggesting wrangler for all local dev add unnecessary friction when using only external services like Supabase.

## Operational Story

- **Preview deploys**: Every push to a non-production branch generates a unique preview URL at `<commit-hash>.<project>.pages.dev`. Preview URLs are public by default — add Cloudflare Access policies if the app handles sensitive data before launch.
- **Secrets**: Environment variables and secrets are managed via `wrangler secret put <KEY>` (encrypted at rest) or the Cloudflare dashboard. For local dev, secrets go in `.dev.vars` (git-ignored). GitHub Actions uses repository secrets (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
- **Rollback**: `wrangler rollback [version-id]` reverts to a previous deployment instantly. Typical time-to-revert: seconds. Database migrations (if using D1) do not roll back automatically — plan down-migrations separately.
- **Approval**: Production deploys via `wrangler deploy` or CI merge require no manual approval by default. To gate production, configure GitHub branch protection rules requiring PR review before merge. Dangerous operations (delete project, rotate API token, drop D1 database) require dashboard confirmation.
- **Logs**: `wrangler tail` streams real-time request logs (status, duration, exceptions). For persistent log storage, configure a Logpush job to R2 or a third-party service. CI pipeline logs live in GitHub Actions.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Node.js-only dependency needed in future | Devil's advocate | Medium | High | Keep AI/heavy-processing calls to external APIs (OpenAI, Supabase Edge Functions). CV text extraction stays text-only in v1 (no PDF parsing). If PDF parsing becomes essential, deploy a single Railway/Render microservice for that endpoint. |
| CPU time limit exceeded on free tier | Devil's advocate | Medium | Low | Monitor CPU time via wrangler tail. Budget $5/mo for paid plan when AI evaluation features ship. Paid tier gives 30s CPU — more than sufficient for CV scoring + question generation. |
| Preview URLs leak pre-launch content | Unknown unknowns | Low | Medium | Add Cloudflare Access with email-based OTP before any sensitive data flows through previews. |
| Wrangler breaking change disrupts dev | Unknown unknowns | Low | Medium | Pin wrangler version in `package.json`. Update deliberately after checking Astro adapter compatibility notes. |
| Vendor lock-in if migration needed | Devil's advocate | Low | High | Use Supabase (external) for all persistent data — not D1/KV. Keep Cloudflare-specific code isolated to adapter config and binding access. |
| Cold starts on rarely-hit SSR routes | Research finding | Low | Low | Cloudflare Workers have near-zero cold starts (V8 isolate spin-up is <5ms). Not a practical concern unlike container platforms. |

## Getting Started

1. **Install wrangler** (if not already): `npm install -D wrangler` (already in the project's devDependencies via the starter).

2. **Authenticate**: `npx wrangler login` — opens browser for OAuth. Creates `~/.wrangler/config/default.toml`.

3. **Configure secrets for production**: 
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_KEY
   ```

4. **Deploy manually** (to verify the pipeline works):
   ```bash
   npm run build && npx wrangler pages deploy dist
   ```

5. **Set up CI auto-deploy**: The GitHub Actions workflow should run `npm run build` then use the `cloudflare/wrangler-action` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets to deploy on merge to `master`.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (covered separately in implementation)
- Production-scale architecture (multi-region, HA, DR)
