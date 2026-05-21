---
project: Assessly
created_at: 2026-05-21
platform: Cloudflare Workers + Pages
trigger: merge to master
status: pending
external_integrations:
  - supabase (auth via @supabase/ssr)
  - cloudflare (hosting, CDN, serverless runtime)
---

# Deploy Plan: Assessly — Production Deployment

Deployment of the Assessly Astro 6 SSR application to Cloudflare Pages with CI auto-deploy on merge to `master`. Covers external integration verification, edge case handling, and operational readiness.

**References:**
- `context/foundation/infrastructure.md` — platform decision & risk register
- `context/foundation/tech-stack.md` — stack constraints & deployment target
- `.github/workflows/ci.yml` — CI/CD pipeline definition

---

## Phase 0 — Prerequisites & Accounts

Ensure all accounts, tooling, and local configuration are ready before any deployment attempt.

- [x] Node.js 22.14.0 installed (matches `.nvmrc`) — *actual: v24.14.1 (compatible, newer than pinned)*
- [x] `npm ci` completes without errors
- [x] Wrangler CLI available (`npx wrangler --version` reports ^4.90.0) — *actual: 4.93.0*
- [x] Cloudflare account created with Workers & Pages enabled
- [x] Supabase project provisioned with auth enabled (email/password provider active)
- [x] `.dev.vars` file created from `.env.example` with valid `SUPABASE_URL` and `SUPABASE_KEY`

**Edge case — Node version mismatch:**
If CI uses a different Node version than local, builds may produce inconsistent output. The `.nvmrc` pins 22.14.0 and CI uses `node-version: 22`. Run `node --version` to confirm before proceeding.

---

## Phase 1 — Local Build & Verification

Validate the build pipeline and Supabase integration locally before touching production.

- [x] `npx astro sync` completes (generates type definitions)
- [x] `npm run build` produces `dist/` directory without errors
- [x] `npx wrangler dev --config dist/server/wrangler.json` starts local server successfully (note: use Workers mode, not Pages mode)
- [x] Auth flow works locally: sign up → sign in → endpoints respond with 302 redirects (Supabase integration functional)
- [x] Static assets (CSS, JS, fonts) load correctly in local preview

**Edge case — Build fails with missing env vars:**
Astro 6 with `astro:env/server` will throw at build time if `SUPABASE_URL` or `SUPABASE_KEY` are undefined. Ensure `.dev.vars` is present for local builds. In CI, these come from GitHub repository secrets.

**Edge case — `wrangler pages dev` vs `astro dev`:**
For routine development, `astro dev` is sufficient and faster. Use `wrangler pages dev dist` only to verify Cloudflare-specific behavior (bindings, headers, runtime limits). The `@astrojs/cloudflare` adapter handles runtime differences.

**Edge case — `wrangler pages dev` fails with "No such module wrangler:modules-watch":**
This occurs when `.wrangler/deploy/config.json` conflicts with the build-generated `dist/server/wrangler.json`. Fix:
```bash
rm -rf .wrangler/deploy
npx wrangler pages dev dist
```
The `.wrangler/deploy/` directory is auto-generated and safe to delete. If the error recurs after a fresh build, always remove `.wrangler/deploy/` first. Note: the KV (`SESSION`) and Images bindings will only appear when the redirected config is in use; without it the server still starts correctly using env vars from `.dev.vars`.

---

## Phase 2 — Production Secrets & First Manual Deploy

Establish Cloudflare authentication and deploy the app manually to validate the full pipeline.

- [x] Run `npx wrangler login` — OAuth flow completes, `~/.wrangler/config/default.toml` created
- [x] Verify account: `npx wrangler whoami` shows correct account ID
- [x] Set production secret: `npx wrangler secret put SUPABASE_URL` (enter Supabase project URL)
- [x] Set production secret: `npx wrangler secret put SUPABASE_KEY` (enter Supabase anon key)
- [x] Verify secrets registered: `npx wrangler secret list` (note: Workers mode, not Pages)
- [x] Deploy manually: `npm run build && npx wrangler deploy --config dist/server/wrangler.json`
- [x] Confirm deployment URL accessible: `https://assessly.bartosz-szerlag.workers.dev` returns HTTP 200

**Edge case — Project name conflict:**
If `assessly` is already taken on Cloudflare Pages, the first deploy will fail with a clear error. Choose an alternative name and update `wrangler.jsonc` → `"name"` field accordingly.

**Edge case — Supabase URL misconfiguration:**
If `SUPABASE_URL` points to a wrong project or uses the wrong key type (service_role instead of anon), auth will silently fail in production. Verify by hitting `/api/auth/signin` with valid credentials immediately after first deploy.

**Support step — Supabase SSR cookies on Cloudflare Workers:**
`@supabase/ssr` relies on cookie manipulation via `Set-Cookie` headers. Cloudflare Workers handles cookies correctly, but ensure:
1. The `cookieOptions` in `src/lib/supabase.ts` do NOT set `sameSite: 'strict'` (use `'lax'`)
2. The production domain matches what Supabase has in its "Site URL" and "Redirect URLs" auth settings
3. If using a custom domain later, update Supabase auth settings to include it

---

## Phase 3 — CI/CD Pipeline Activation

Enable automated deploys through GitHub Actions.

- [ ] Add GitHub repository secret: `CLOUDFLARE_API_TOKEN` (create via Cloudflare dashboard → API Tokens → "Edit Cloudflare Workers" template; needs Workers Scripts:Edit, Pages:Edit, Account Settings:Read)
- [ ] Add GitHub repository secret: `CLOUDFLARE_ACCOUNT_ID` (visible in dashboard URL or via `npx wrangler whoami`)
- [ ] Verify existing secrets present: `SUPABASE_URL`, `SUPABASE_KEY` (needed for build step in CI)
- [ ] Push a commit to `master` — confirm CI runs: lint → build → deploy
- [ ] Confirm new deployment appears: `npx wrangler pages deployment list --project-name assessly`

**Edge case — CI deploy fires on PRs:**
The workflow guard `if: github.event_name == 'push' && github.ref == 'refs/heads/master'` prevents this. If deploy runs unexpectedly on PRs, verify the `ci.yml` `deploy` job has this condition.

**Edge case — Build passes locally but fails in CI:**
Common causes:
1. Missing `npx astro sync` step before build (generates `.astro/` types)
2. Secrets not available — check GitHub Settings → Secrets → Actions
3. `npm ci` fails due to lockfile mismatch — run `npm install` locally and commit updated `package-lock.json`

---

## Phase 4 — Post-Deploy Validation

Verify the production deployment is fully functional.

- [ ] Homepage loads with correct styling (Tailwind CSS applied)
- [ ] JavaScript hydration works (React islands interactive)
- [ ] Sign up flow: new user can register via `/api/auth/signup`
- [ ] Sign in flow: existing user can authenticate via `/api/auth/signin`
- [ ] Sign out flow: session cleared, redirected to public page
- [ ] Error handling: invalid routes return appropriate error page (not raw Cloudflare error)

**Edge case — Cookies not persisting after sign-in:**
Symptoms: user signs in successfully but is immediately unauthenticated on next request.
Causes & fixes:
1. **Missing `Secure` flag in production** — Cloudflare always serves HTTPS, so `Secure: true` is correct for production cookies
2. **Domain mismatch** — if accessing via `assessly.pages.dev` but cookies are set for a custom domain
3. **Middleware not running** — verify `src/middleware.ts` is included in the build output (check `dist/_worker.js`)

**Edge case — Static assets 404:**
If CSS/JS files return 404 in production but work locally:
1. Verify `wrangler.jsonc` has `"assets": { "directory": "./dist" }`
2. Check that `astro build` output includes the expected `_astro/` directory inside `dist/`
3. Confirm the `ASSETS` binding is present in wrangler config

---

## Phase 5 — Operational Readiness

Establish procedures for ongoing operation, monitoring, and incident response.

- [ ] Perform rollback drill: deploy a trivial change, then rollback (see Rollback Procedure below)
- [ ] Verify log tailing works: `npx wrangler tail --project-name assessly` shows live requests
- [ ] Document preview URL policy: preview deploys at `<hash>.assessly.pages.dev` are PUBLIC by default
- [ ] Enable Cloudflare observability (already set in `wrangler.jsonc`: `"observability": { "enabled": true }`)
- [ ] Bookmark Cloudflare Analytics dashboard for request count & error rate monitoring

**Edge case — Preview URLs exposing pre-launch content:**
All preview URLs are publicly accessible. If the app handles sensitive data before launch, configure Cloudflare Access (zero-trust policy) to restrict preview URLs to team email addresses via OTP.

---

## Rollback Procedure

If a production deployment causes issues:

```bash
# 1. List recent deployments
npx wrangler pages deployment list --project-name assessly

# 2. Rollback to a specific deployment
npx wrangler pages deployment rollback [deployment-id] --project-name assessly

# 3. Verify rollback took effect
curl -I https://assessly.pages.dev
```

**Time to revert:** seconds (Cloudflare edge propagation is near-instant).

**Important:** Rollback reverts application code only. If a database migration (Supabase) was applied alongside the deploy, it must be reverted separately via a down-migration SQL script.

---

## External Integration Checklist

### Supabase

| Check | Command/Action |
|-------|---------------|
| Project URL resolves | `curl https://<project-ref>.supabase.co/rest/v1/` returns JSON |
| Anon key works | Auth endpoints respond with proper error messages (not 500) |
| Auth providers enabled | Supabase dashboard → Auth → Providers → Email enabled |
| Site URL configured | Supabase dashboard → Auth → URL Configuration → set to production URL |
| Redirect URLs include prod | Add `https://assessly.pages.dev/**` to allowed redirect URLs |
| RLS enabled on all tables | Verify via Supabase dashboard → Table Editor → RLS badge on each table |

### Cloudflare

| Check | Command/Action |
|-------|---------------|
| Worker deployed | `npx wrangler pages deployment list --project-name assessly` |
| Secrets set | `npx wrangler pages secret list --project-name assessly` |
| Custom domain (if any) | Cloudflare dashboard → Pages → Custom domains |
| `nodejs_compat` active | Verify `"compatibility_flags": ["nodejs_compat"]` in `wrangler.jsonc` |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `SUPABASE_URL` not set — runtime crash | Medium | High | Verify with `wrangler pages secret list` before every first deploy |
| Worker name conflict on Cloudflare | Low | Low | First deploy fails clearly; choose alternative name |
| CI deploy fires on PRs accidentally | Low | Medium | Guard: `if: github.event_name == 'push' && github.ref == 'refs/heads/master'` |
| Wrangler/Astro adapter version incompatibility | Low | Medium | Pin wrangler in `package.json`; update deliberately after checking adapter release notes |
| `nodejs_compat` missing — runtime import failures | Low | High | Flag is set in `wrangler.jsonc`; never remove without testing all dependencies |
| Preview URLs leak pre-launch content | Low | Medium | Add Cloudflare Access before sensitive data flows through previews |
| Supabase auth cookies fail on Workers | Low | High | Use `sameSite: 'lax'`, verify `Secure: true`, match Site URL in Supabase dashboard |
| CPU time limit exceeded (free tier: 10ms) | Low (current) | Low | Monitor via `wrangler tail`; upgrade to $5/mo paid plan if needed when adding compute-heavy features |

---

## Completion Criteria

All phases complete when:
1. Every checkbox in Phases 0–5 is checked
2. At least one successful automated deploy via CI has been confirmed
3. Auth flow verified end-to-end in production
4. Rollback drill completed successfully
5. Team knows how to access logs and trigger rollbacks
