# Database Schema and RLS — Plan Brief

> Full plan: `context/changes/database-schema-and-rls/plan.md`

## What & Why

Create the foundational database tables (`positions`, `candidates`, `evaluations`), RLS policies, and TypeScript types that all downstream features depend on. Without this foundation, no application logic can be built — S-01 (position management), S-02 (CV upload), and S-03 (AI evaluation) all require these tables and access control.

## Starting Point

The project has Supabase configured for auth only — no custom tables, no migrations directory, no TypeScript type definitions. The Supabase client (`src/lib/supabase.ts`) and auth middleware (`src/middleware.ts`) are in place and working.

## Desired End State

Three tables with RLS enforcing per-user data isolation exist in the database. A Storage bucket for CV PDFs is configured. TypeScript interfaces matching the schema are available for import via `@/types`. Running `npx supabase db reset` produces a clean database ready for S-01 to build on.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|----------|--------|-------------------|
| Requirements storage | JSONB array on positions table | Requirements are always read as a batch for AI evaluation; no need for per-requirement SQL queries. |
| Seniority type | PostgreSQL enum | Type-safe at DB level with clear allowed values; stable enumeration unlikely to change often. |
| Evaluation storage | Single evaluations row per position run | AI returns one atomic response; JSONB captures the full result without over-normalization. |
| CV storage | Storage bucket + extracted text in DB | Preserves original PDF for re-download/re-extraction while keeping text queryable. |
| Timestamps | created_at + updated_at with trigger | Essential for the "stale results" warning (PRD) and general audit trail. |
| Delete strategy | Hard delete for MVP | No compliance requirement; simpler queries without ghost rows. |
| RLS ownership | Transitive via position FK | Single ownership column on positions; candidates/evaluations verify via subquery. |

## Scope

**In scope:**
- SQL migration with 3 tables, 1 enum, 1 trigger function, indexes
- RLS policies (per-operation) on all tables
- Storage bucket `cvs` (private, PDF-only, 5MB limit)
- TypeScript type definitions in `src/types.ts`
- RLS verification SQL script

**Out of scope:**
- API routes (S-01)
- Zod validation schemas (created with their API routes)
- Storage bucket RLS policies (S-02)
- UI components
- Seed data beyond test verification

## Architecture / Approach

Single migration file establishes the entire schema. Ownership flows top-down: `auth.users` → `positions` (via `user_id`) → `candidates`/`evaluations` (via `position_id` FK). RLS on child tables uses a subquery (`position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())`) to enforce transitive access control without denormalization.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Migration — Schema & RLS | Complete SQL migration with tables, enum, trigger, RLS, storage bucket | Schema may need adjustments when AI evaluation logic is built (mitigated: additive migrations are cheap) |
| 2. TypeScript Types | `src/types.ts` with interfaces for all entities and JSONB structures | JSONB shapes are speculative until AI response format is finalized (mitigated: types are easy to extend) |
| 3. Verification | RLS verification script confirming data isolation | Test coverage is manual SQL — no automated integration test runner yet |

**Prerequisites:** Local Supabase running (`npx supabase start` requires Docker)
**Estimated effort:** ~1 session (1-2 hours across 3 phases)

## Open Risks & Assumptions

- JSONB shapes for `candidate_scores`, `ranking`, and `questions` are designed based on PRD requirements but may evolve when the AI prompt engineering happens in S-03. Additive changes are non-breaking.
- The `evaluations.position_id` UNIQUE constraint assumes one evaluation per position (re-evaluation overwrites). If evaluation history is needed later, this constraint would be dropped in a new migration.

## Success Criteria (Summary)

- `npx supabase db reset` applies cleanly with all tables, RLS, and storage bucket
- A simulated user can only access their own positions/candidates/evaluations (verified via SQL)
- `npm run build` passes with the new TypeScript types
