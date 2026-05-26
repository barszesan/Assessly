---
project: "Assessly"
version: 1
status: draft
created: 2026-05-25
updated: 2026-05-25
prd_version: 1
main_goal: speed
top_blocker: decisions
---

# Roadmap: Assessly

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Recruiters on a small team spend too much time manually reviewing CVs and matching candidates to open positions. Assessly combines position creation with structured requirements, multi-CV upload (PDF), comparative AI ranking, and interview question generation — in a single flow. The system replaces the existing candidate-first flow with a new position-first approach, preserving the entire existing tech stack and authentication.

## North star

**S-03: AI evaluation with ranking and questions** — the recruiter uploads 3+ CVs to a position and receives a candidate ranking (best match + option B) along with 5 interview questions tailored to the position's requirements and seniority level.

> The north star is the smallest end-to-end slice whose delivery proves the core product hypothesis — placed as early as dependencies allow, because everything else only matters if this works.

## At a glance

| ID | Change ID | Outcome (user can …) | Prerequisites | PRD refs | Status |
|---|---|---|---|---|---|
| F-01 | database-schema-and-rls | (foundation) database schema and RLS policies for positions, candidates, and evaluations | — | NFR (data isolation), FR-001, FR-003, FR-004 | ready |
| F-02 | ai-provider-integration | (foundation) AI provider selected and integrated; base prompt routing works | — | FR-004, FR-005 | ready |
| S-01 | position-management | create a position with structured requirements and seniority; view, edit, and delete positions | F-01 | US-01, US-02, FR-001, FR-002 | proposed |
| S-02 | cv-upload-and-extraction | upload PDFs to a position and confirm text extraction before evaluation | S-01, F-01 | US-01, US-02, FR-003 | proposed |
| S-03 | ai-evaluation-and-questions | trigger AI evaluation — ranking (tiered: 1/2/3+ CVs) + 5 interview questions per position | S-02, F-02 | US-01, US-02, FR-004, FR-005 | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme | Chain | Note |
|---|---|---|---|
| A | Positions & evaluation | `F-01` → `S-01` → `S-02` → `S-03` | Critical path to north star; speed demands linear execution without distraction. |
| B | AI integration | `F-02` | Parallel with Stream A (F-01 → S-01 → S-02); joins Stream A at `S-03`. |

## Baseline

What's already in place in the codebase as of `2026-05-25` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19 islands + shadcn/ui + Tailwind 4 (`astro.config.mjs`, `src/pages/`, `src/components/ui/`)
- **Backend / API:** partial — Astro SSR file-based API routes present (`src/pages/api/auth/`); no zod validation in existing endpoints
- **Data:** partial — Supabase client configured (`src/lib/supabase.ts`); no migrations or schemas in `supabase/migrations/`
- **Auth:** present — Supabase Auth (email + OAuth), middleware in `src/middleware.ts`, auth endpoints
- **Deploy / infra:** present — Cloudflare Workers (`wrangler.jsonc`) + GitHub Actions CI (`.github/workflows/ci.yml`)
- **Observability:** absent — no logger, error tracking, or metrics (parked under `speed` goal)

## Foundations

### F-01: Database schema and RLS

- **Outcome:** (foundation) `positions`, `candidates`, `evaluations` tables with Supabase migrations and RLS policies ensuring per-user data isolation.
- **Change ID:** database-schema-and-rls
- **PRD refs:** NFR (data isolation via Supabase RLS), FR-001, FR-003, FR-004
- **Unlocks:** S-01, S-02, S-03
- **Prerequisites:** —
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Schema designed too early may require corrective migrations when AI logic reveals new needs; sequenced first because all slices depend on it.
- **Status:** ready

### F-02: AI provider integration

- **Outcome:** (foundation) AI provider selected, API key configured in `.dev.vars`, base prompt routing via Astro API endpoint works end-to-end.
- **Change ID:** ai-provider-integration
- **PRD refs:** FR-004, FR-005
- **Unlocks:** S-03
- **Prerequisites:** —
- **Parallel with:** F-01
- **Blockers:** —
- **Unknowns:**
  - Which AI provider (OpenAI / Anthropic / OpenRouter / other) and which model? — Owner: user. Block: no.
- **Risk:** Provider choice determines cost and evaluation quality; delaying the decision too long blocks S-03. Sequenced in parallel with F-01 to avoid extending the critical path.
- **Status:** ready

## Slices

### S-01: Position management

- **Outcome:** recruiter can create a position with a structured requirements list and seniority level; view, edit, and delete their positions. Editing after evaluation shows a stale-results warning.
- **Change ID:** position-management
- **PRD refs:** FR-001, FR-002, US-01, US-02
- **Prerequisites:** F-01
- **Parallel with:** F-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Requirements structure (flat list vs. categories vs. weights) affects AI prompt quality downstream; a simple flat list is sufficient for MVP and easy to extend.
- **Status:** proposed

### S-02: CV upload and extraction

- **Outcome:** recruiter can upload 1-10 PDFs (max 5MB each) to a position; after upload they see a preview of extracted text and can confirm/correct before evaluation.
- **Change ID:** cv-upload-and-extraction
- **PRD refs:** FR-003, US-01, US-02
- **Prerequisites:** S-01, F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** PDF text extraction is unreliable for complex layouts; the confirmation preview (per PRD) mitigates this risk, but the UX confirmation step adds friction.
- **Status:** proposed

### S-03: AI evaluation and interview questions

- **Outcome:** recruiter triggers evaluation — AI scores candidates per-requirement, ranks comparatively (1 CV = individual fit assessment, 2 CVs = pick the better match, 3+ CVs = best match + option B), can reject all if none meet minimum fitness; generates 5 interview questions per position (based on requirements and seniority). Response appears in < 30s.
- **Change ID:** ai-evaluation-and-questions
- **PRD refs:** FR-004, FR-005, US-01, US-02
- **Prerequisites:** S-02, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - How to ensure no bias in AI evaluations (gender, age, ethnicity) — what prompt guardrails? — Owner: user. Block: no.
- **Risk:** This is the north star and the most complex slice (tiered logic, prompt engineering, <30s timeout). Sequenced last because it requires all preceding elements; failure here invalidates the entire product.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID | Suggested issue title | Ready for `/10x-plan` | Notes |
|---|---|---|---|---|
| F-01 | database-schema-and-rls | DB schema: positions, candidates, evaluations + RLS | yes | Run `/10x-plan database-schema-and-rls` |
| F-02 | ai-provider-integration | AI provider integration (selection + scaffold) | yes | Run `/10x-plan ai-provider-integration` |
| S-01 | position-management | Position CRUD with structured requirements | no | Waiting on F-01 |
| S-02 | cv-upload-and-extraction | PDF upload + text extraction with preview | no | Waiting on S-01 |
| S-03 | ai-evaluation-and-questions | AI evaluation: ranking + interview questions | no | Waiting on S-02 + F-02 |

## Open Roadmap Questions

1. **Which AI provider and model?** — Owner: user. Block: F-02 (planning can start, but implementation requires a decision).
2. **What anti-bias guardrails in the AI prompt?** — Owner: user. Block: S-03 (does not block planning, but required before production per PRD §Guardrails).

## Parked

- **Mobile app** — Why parked: PRD §Non-Goals; web only for MVP, constrain surface.
- **Other document formats (DOCX, images)** — Why parked: PRD §Non-Goals; PDF only simplifies extraction.
- **Live coding task generation** — Why parked: PRD §Non-Goals; evaluation + questions is the v1 scope.
- **Candidate self-service** — Why parked: PRD §Non-Goals; internal tool for recruiters only.
- **ATS integration** — Why parked: PRD §Non-Goals; standalone tool for v1.
- **Position sharing between users** — Why parked: PRD §Non-Goals; flat user model for MVP.
- **Observability (logging, error tracking, metrics)** — Why parked: layer absent in baseline but does not block launch under `speed` goal; to be added post-MVP.

## Done

