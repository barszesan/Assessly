---
project: Assessly
assessed_at: 2026-05-21
agent_readiness: ready
context_type: brownfield
stack_components:
  language: TypeScript 5.9
  framework: Astro 6 with React 19 islands
  build_tool: Vite 7 (via Astro)
  test_runner: null
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers/Pages
gates_passed: 4
gates_failed: 0
---

## Stack Components

**Language: TypeScript 5.9** — Strict mode enabled via `tsconfig.json` extending `astro/tsconfigs/strict`. The `@astrojs/check` package provides Astro-specific type checking. All source files use `.ts`, `.tsx`, or `.astro` extensions with full type inference.

**Framework: Astro 6.3 with React 19 islands** — Astro provides file-based routing (`src/pages/`), SSR via Cloudflare adapter (`@astrojs/cloudflare`), and island architecture for interactive React components. UI layer uses shadcn/ui (new-york style) with Tailwind 4 and `class-variance-authority` + `clsx` + `tailwind-merge` for styling.

**Build tool: Vite 7** — Bundled with Astro; overridden to `^7.3.2` in package.json. Handles dev server, HMR, and production builds.

**Test runner: None detected** — No vitest, jest, or playwright configuration found. No test scripts in package.json. This is noted as a health concern for `/10x-health-check`.

**Package manager: npm** — Evidenced by `package-lock.json`.

**CI/CD: GitHub Actions** — `.github/workflows/ci.yml` present. Runs lint and build on pushes and PRs to master.

**Deployment: Cloudflare Workers/Pages** — `wrangler` in devDependencies, `@astrojs/cloudflare` adapter, deploy script uses `wrangler pages deploy dist`.

**Instruction files: CLAUDE.md, AGENTS.md** — Both present at project root. Document project conventions, coding standards, and project structure for AI agents.

## Quality Gate Assessment

| Component   | Typed | Convention | Training Data | Documented | Verdict |
|-------------|-------|------------|---------------|------------|---------|
| Language    | pass  | —          | —             | —          | pass    |
| Framework   | —     | pass       | pass          | pass       | pass    |
| Build tool  | —     | pass       | pass          | pass       | pass    |
| Test runner | —     | —          | —             | —          | N/A     |

All scored components pass all applicable gates.

### Gate Details

**Gate 1 — Typed: PASS**
- Evidence: `tsconfig.json` extends `astro/tsconfigs/strict`. TypeScript 5.9.3 in devDependencies. `@astrojs/check` provides additional Astro template type checking. All project code is TypeScript by default.

**Gate 2 — Convention-based: PASS**
- Evidence: Astro 6 enforces file-based routing (`src/pages/` maps to URL paths), island architecture (explicit `client:*` directives for interactive components), clear separation of `.astro` (static) and `.tsx` (interactive) components. Conventions are further documented in AGENTS.md (component naming, path aliases, API route patterns).

**Gate 3 — Popular in training data: PASS**
- Evidence: Astro is a top-tier meta-framework in the JS/TS ecosystem with extensive community content, tutorials, and Stack Overflow presence. React 19 is the most popular UI library globally. Tailwind CSS and shadcn/ui are mainstream styling choices. All components are well-represented in LLM training data.

**Gate 4 — Well-documented: PASS**
- Evidence: Astro maintains versioned docs at docs.astro.build with per-version API references and guides. React has comprehensive docs at react.dev. Tailwind CSS and shadcn/ui both have current, actively maintained documentation. Supabase has versioned client library docs.

## Gaps & Compensation

No quality gate failures detected. All four criteria pass for every scored component.

**Advisory (not a gate failure):** No test runner is configured. While this does not affect agent-friendliness scoring (the agent can still write correct code), it means:
- The agent cannot self-verify changes via automated tests.
- Regression detection depends entirely on manual testing or the lint/build CI gate.
- This will be assessed in detail by `/10x-health-check`.

### Recommended Instruction File Additions

No compensation entries are needed for gate failures. The existing CLAUDE.md and AGENTS.md already document:
- Project structure and conventions
- Component naming and file organization
- Path alias usage (`@/*` maps to `./src/*`)
- API route patterns
- Styling conventions (cn() helper, shadcn/ui usage)

**Optional enhancement for the pivot:** Once the Assessly domain code is implemented, consider adding a section to AGENTS.md documenting:
- The candidate evaluation flow (which services are involved)
- The AI integration pattern used for CV evaluation and question generation
- Database schema for candidates, job descriptions, and evaluations

## Summary

**Verdict: ready** — The stack passes all four agent-friendly quality gates for every scored component. TypeScript strict mode provides full type safety. Astro's file-based routing and island architecture provide strong conventions. Both Astro and React are mainstream frameworks with extensive training data and current documentation. Existing instruction files (CLAUDE.md, AGENTS.md) already document project-specific conventions.

**Key strengths:**
- Full type safety end-to-end (TypeScript strict + Astro check)
- Strong conventions via framework (file-based routing, island architecture)
- Mainstream stack with high training-data coverage
- Pre-existing instruction files for AI agents

**Key gap:**
- No test runner configured — the agent cannot self-verify changes. Address in `/10x-health-check`.

**Recommended next step:** `/10x-health-check` — to audit dependency health, assess the missing test runner, evaluate CI coverage, and check for security concerns before implementing the Assessly pivot.
