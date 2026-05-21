---
bootstrapped_at: 2026-05-19T10:25:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: assessly
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: assessly
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

A solo developer shipping a book-recommendation MVP in 3 weeks of after-hours work with auth and an AI recommendation feature needs a battle-tested, agent-friendly starter that handles auth + database + deploy out of the box. 10x Astro Starter (Astro + Supabase + Cloudflare) is the recommended default for (web-app, js) and clears all four agent-friendly gates — typed (TypeScript + Zod), convention-based, popular in training data, and well-documented. Auth is handled by Supabase's built-in auth module; AI recommendation calls route through Astro API endpoints. CI runs on GitHub Actions with auto-deploy-on-merge to Cloudflare Pages.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | — | cmd_template uses git clone; no npm create-* CLI to check |
| GitHub repo | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh | from card.docs_url |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 19
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently (none pre-existed in cwd)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 10 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/3/0 direct of total 0/1/10/0

#### HIGH findings

- **devalue** v5.6.3–5.8.0 — GHSA-77vg-94rm-hx3p — DoS via sparse array deserialization (CVSS 7.5). Transitive. Fix available.

#### MODERATE findings

- **@astrojs/check** (direct) — via @astrojs/language-server → volar-service-yaml → yaml-language-server → yaml. Fix: downgrade to 0.9.2.
- **@astrojs/cloudflare** (direct) — via @cloudflare/vite-plugin, wrangler → miniflare → ws. Fix: downgrade to 12.6.13.
- **wrangler** (direct) — via miniflare → ws. Fix: downgrade to 3.107.3.
- **@astrojs/language-server** (transitive) — via volar-service-yaml.
- **@cloudflare/vite-plugin** (transitive) — via miniflare, wrangler, ws.
- **miniflare** (transitive) — via ws.
- **volar-service-yaml** (transitive) — via yaml-language-server.
- **ws** (transitive) — GHSA-58qx-3vcg-4xpx — Uninitialized memory disclosure (CVSS 4.4).
- **yaml** (transitive) — GHSA-48c2-rrv3-qjmp — Stack Overflow via deeply nested YAML collections (CVSS 4.3).
- **yaml-language-server** (transitive) — via yaml.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | first-class |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | true |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
