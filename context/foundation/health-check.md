---
project: Assessly
checked_at: 2026-05-21
health_status: needs-attention
context_type: brownfield
stack_assessment_linked: true
findings:
  critical: 0
  high: 1
  moderate: 10
  low: 0
  test_runner: not detected
  ci_provider: GitHub Actions
  ci_stages:
    lint: true
    test: false
    build: true
    type_check: implicit
    security: false
---

## Pre-check: Dependency Audit

### Lockfile

Present: `package-lock.json` (npm). Dependency versions are pinned and reproducible.

### Security Audit

| Severity | Count | Direct | Transitive |
|----------|-------|--------|------------|
| CRITICAL | 0     | 0      | 0          |
| HIGH     | 1     | 0      | 1          |
| MODERATE | 10    | 0      | 10         |
| LOW      | 0     | 0      | 0          |

**HIGH finding:**
- `devalue` (transitive) — Svelte devalue: DoS via sparse array deserialization. Advisory: https://github.com/advisories/GHSA-77vg-94rm-hx3p. This is a transitive dependency (not directly controlled); likely pulled in by Astro's SSR internals.

**MODERATE findings:** 10 moderate-severity advisories in transitive dependencies. These are logged but do not require immediate action.

### Outdated Dependencies

14 packages have newer versions available. No major version gaps (all within the same major version). No action needed — these are minor/patch updates that can be addressed during routine maintenance.

## In-check: Test Infrastructure & CI/CD

### Test Runner

**Not detected.** No vitest, jest, playwright, or cypress configuration found. No test-related scripts in package.json. No test files detected in the project.

**Impact on AI assistant workflows:** The AI assistant cannot self-verify its changes via automated tests. Regression detection depends entirely on manual testing, the lint step, and the build step in CI. For the Assessly pivot (new domain logic for CV evaluation and question generation), this means AI-generated code cannot be automatically validated against expected behavior.

**Cross-reference with stack-assessment:** This confirms the sole advisory gap identified in `context/foundation/stack-assessment.md`: "No test runner configured — the agent cannot self-verify changes."

### CI/CD Configuration

**Provider:** GitHub Actions (`.github/workflows/ci.yml`)

| Stage | Status | Details |
|-------|--------|---------|
| Lint | present | `npm run lint` (eslint with TypeScript, React, Astro, a11y plugins) |
| Test | missing | No test step — consistent with no test runner |
| Build | present | `npm run build` (includes Astro type checking) |
| Type-check | implicit | Astro build runs `@astrojs/check`; no explicit `tsc --noEmit` step |
| Security | missing | No `npm audit`, Dependabot, CodeQL, or Snyk step |
| Deploy | present | Cloudflare Pages deploy on push to master (via wrangler-action) |

The CI pipeline is functional but minimal: lint + build + deploy. It catches syntax errors, lint violations, and type errors (via Astro build), but cannot catch logic regressions (no tests) or security vulnerabilities (no audit step).

### Configuration Files

| File | Status | Notes |
|------|--------|-------|
| `.gitignore` | present | — |
| `.env.example` | present | Documents required environment variables |
| `tsconfig.json` (strict) | present | Extends `astro/tsconfigs/strict` |
| ESLint | present | Flat config (`eslint.config.js`) with TS, React, Astro, a11y, Prettier plugins |
| Prettier | present | Via `eslint-plugin-prettier` + `prettier-plugin-astro` + `prettier-plugin-tailwindcss` |
| Husky + lint-staged | present | Pre-commit hooks: eslint --fix on TS/TSX/Astro, prettier --write on JSON/CSS/MD |
| `.editorconfig` | missing | Low severity — Prettier handles formatting |
| CLAUDE.md | present | AI assistant instruction file |
| AGENTS.md | present | AI assistant instruction file |

## Prioritized Fixes

### Category A — Fix before AI assistant work

#### 1. Install and configure a test runner (significant — ~30 min)

**What:** No test runner is configured. The AI assistant cannot verify its changes.

**Why it matters:** For the Assessly pivot, new business logic (CV evaluation, question generation) will be written by the AI assistant. Without tests, there is no automated way to verify correctness, catch regressions, or validate edge cases.

**Fix:**
```bash
npm init vitest@latest
```

Then add a test script to `package.json`:
```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Vitest is recommended because it shares Vite's config (already in use via Astro), supports TypeScript natively, and is the most popular test runner in the Vite ecosystem.

#### 2. Review HIGH transitive vulnerability (quick — < 5 min)

**What:** `devalue` has a DoS vulnerability via sparse array deserialization (GHSA-77vg-94rm-hx3p). It's a transitive dependency — likely pulled in by Astro internals.

**Why it matters:** While this is a DoS vector (not data exposure), it's in the SSR rendering path. For an internal tool with small user base, the risk is low but should be tracked.

**Fix:**
```bash
npm audit
# Check if a patched version is available via Astro update:
npm update astro
# If still present after update, accept the risk for now — it's transitive and low-impact for an internal tool.
```

#### 3. Add .editorconfig (quick — < 5 min)

**What:** No `.editorconfig` file. Low severity since Prettier handles formatting, but it ensures consistent indentation in editors that don't have Prettier integration.

**Why it matters:** Minor — Prettier + lint-staged already enforce formatting. This is a convenience for IDE consistency.

**Fix:** Create `.editorconfig`:
```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

### Category B — Addressed in upcoming lessons

#### 4. Add test step to CI (upcoming lesson)

**What:** CI runs lint + build but no test step.

**Why it matters:** Once a test runner is installed (fix #1), CI should run tests to prevent regressions from merging.

**Forward reference:** You'll set up CI enhancements in [Sprint Zero z Agentem: infrastruktura, walking skeleton i pierwszy deploy (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5). For now, local test runner coverage is what matters for AI assistant collaboration.

#### 5. Add security scanning to CI (upcoming lesson)

**What:** No `npm audit` or Dependabot step in the CI pipeline.

**Why it matters:** Security vulnerabilities in dependencies are only caught by manual `npm audit` runs today. Automated scanning surfaces them before merge.

**Forward reference:** Infrastructure and CI/CD hardening is covered in [Sprint Zero z Agentem (M1L5)](https://platforma.przeprogramowani.pl/external/10xdevs-3/m1-l5).

## Summary

**Verdict: needs-attention** — The project is well-configured for code quality (strict TypeScript, comprehensive linting, formatting, pre-commit hooks) but lacks a test runner, which is the primary gap for AI assistant collaboration. One HIGH transitive vulnerability exists but is low-risk for an internal tool.

**Strengths:**
- Lockfile present — reproducible builds
- Strong linting and formatting (ESLint + Prettier + lint-staged + Husky)
- TypeScript strict mode with Astro-specific type checking
- CI pipeline functional (lint + build + deploy)
- Environment variables documented (`.env.example`)
- AI instruction files present (CLAUDE.md, AGENTS.md)

**Key gaps (Category A):**
- No test runner — the AI assistant cannot self-verify changes (priority #1)
- 1 HIGH transitive vulnerability — low-risk but worth tracking

**Key gaps (Category B — upcoming lessons):**
- No test step in CI
- No security scanning in CI

**Recommended next step:** Install Vitest (fix #1), then proceed to AI assistant onboarding. The brownfield chain is complete — both greenfield and brownfield paths converge with equivalent context artifacts from this point.
