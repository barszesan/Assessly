# Database Schema and RLS Implementation Plan

## Overview

Create the foundational database layer for Assessly's position-first flow: three tables (`positions`, `candidates`, `evaluations`), a seniority enum, an `updated_at` auto-trigger, Row Level Security policies enforcing per-user data isolation, a Supabase Storage bucket for CV PDFs, and TypeScript type definitions consumed by all downstream slices.

## Current State Analysis

- **Supabase client**: configured via `@supabase/ssr` in `src/lib/supabase.ts:5` — creates a server client with cookie-based session management.
- **Auth middleware**: `src/middleware.ts:12` extracts authenticated user via `supabase.auth.getUser()` and sets `context.locals.user`. RLS policies can use `auth.uid()`.
- **No migrations exist**: `supabase/migrations/` directory doesn't exist yet. This is the first migration.
- **No custom tables**: the project only uses Supabase Auth currently.
- **No TypeScript types**: `src/types.ts` doesn't exist. No zod schemas either.
- **Storage enabled**: `supabase/config.toml` has `[storage] enabled = true` with 50MiB limit.

### Key Discoveries:

- `createClient()` returns `null` when env vars are missing (`src/lib/supabase.ts:6-8`) — downstream code must handle this.
- Supabase config uses PostgreSQL 17 (`supabase/config.toml:36`).
- Migration naming convention per AGENTS.md: `YYYYMMDDHHmmss_short_description.sql`.
- AGENTS.md mandates: "Always enable RLS on new Supabase tables with granular per-operation, per-role policies."

## Desired End State

After this plan is complete:
1. `npx supabase db reset` applies cleanly with all tables, enum, trigger, RLS policies, and storage bucket.
2. A logged-in user can only access their own positions (and transitively, their candidates/evaluations) — verified via SQL test queries against the local Supabase instance.
3. `src/types.ts` exports TypeScript interfaces matching the schema, ready for import by S-01 (position management) and subsequent slices.

## What We're NOT Doing

- No API routes — those come in S-01 (position management).
- No zod validation schemas — those will be created alongside the API routes that need them.
- No UI components or pages.
- No seed data beyond what's needed for RLS verification.
- No Supabase Storage policies for the CV bucket — those come in S-02 (cv-upload-and-extraction) when the upload flow is implemented.

## Implementation Approach

Single migration file containing the complete schema. RLS policies use `auth.uid()` for positions (direct ownership) and a subquery through `position_id` for candidates and evaluations (transitive ownership). TypeScript types mirror the database schema as interfaces for use in API routes and components.

## Phase 1: Migration — Schema & RLS

### Overview

Create the SQL migration file with the complete schema: enum type, three tables, auto-update trigger, RLS policies, and storage bucket.

### Changes Required:

#### 1. Create migrations directory

**File**: `supabase/migrations/` (new directory)

**Intent**: Establish the migrations directory that Supabase CLI expects.

**Contract**: Directory must exist for `npx supabase db reset` to find migration files.

#### 2. SQL migration file

**File**: `supabase/migrations/20260525120000_create_positions_candidates_evaluations.sql`

**Intent**: Define the complete database schema for the position-first evaluation flow. One migration with: seniority enum, three tables with appropriate columns and constraints, an auto-updating `updated_at` trigger function reused across all tables, RLS enabled with granular per-operation policies, and a storage bucket for CV PDFs.

**Contract**:

Schema design decisions:
- `seniority_level` enum: `junior`, `mid`, `senior`, `lead`, `principal`
- `positions` table: `id` (uuid PK, gen_random_uuid), `user_id` (uuid NOT NULL, references auth.users), `title` (text NOT NULL), `description` (text), `seniority` (seniority_level NOT NULL), `requirements` (jsonb NOT NULL DEFAULT '[]'), `created_at` (timestamptz DEFAULT now()), `updated_at` (timestamptz DEFAULT now())
- `candidates` table: `id` (uuid PK), `position_id` (uuid NOT NULL FK → positions ON DELETE CASCADE), `file_name` (text NOT NULL), `file_path` (text NOT NULL), `extracted_text` (text), `created_at`, `updated_at`
- `evaluations` table: `id` (uuid PK), `position_id` (uuid NOT NULL FK → positions ON DELETE CASCADE, UNIQUE), `candidate_scores` (jsonb NOT NULL), `ranking` (jsonb), `all_rejected` (boolean NOT NULL DEFAULT false), `questions` (jsonb NOT NULL DEFAULT '[]'), `created_at`, `updated_at`
- `evaluations.position_id` has a UNIQUE constraint — one evaluation per position (re-evaluation overwrites).
- Trigger function `update_updated_at()` sets `NEW.updated_at = now()` BEFORE UPDATE on all three tables.
- RLS policies:
  - `positions`: SELECT/INSERT/UPDATE/DELETE where `auth.uid() = user_id`
  - `candidates`: SELECT/INSERT/UPDATE/DELETE where `position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())`
  - `evaluations`: same pattern as candidates
- Storage: create bucket `cvs` (private, 5MB file size limit, allowed MIME type `application/pdf`)

```sql
-- Seniority enum
CREATE TYPE seniority_level AS ENUM ('junior', 'mid', 'senior', 'lead', 'principal');

-- Updated_at trigger function (reused across tables)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Positions table
CREATE TABLE positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  seniority seniority_level NOT NULL,
  requirements jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_positions_user_id ON positions(user_id);

CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Candidates table
CREATE TABLE candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_position_id ON candidates(position_id);

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Evaluations table
CREATE TABLE evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  candidate_scores jsonb NOT NULL,
  ranking jsonb,
  all_rejected boolean NOT NULL DEFAULT false,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evaluations_position_id_unique UNIQUE (position_id)
);

CREATE TRIGGER evaluations_updated_at
  BEFORE UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable RLS
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Positions RLS: direct ownership
CREATE POLICY "Users can select own positions"
  ON positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON positions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON positions FOR DELETE
  USING (auth.uid() = user_id);

-- Candidates RLS: transitive ownership via position
CREATE POLICY "Users can select own candidates"
  ON candidates FOR SELECT
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own candidates"
  ON candidates FOR INSERT
  WITH CHECK (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own candidates"
  ON candidates FOR UPDATE
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()))
  WITH CHECK (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own candidates"
  ON candidates FOR DELETE
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

-- Evaluations RLS: transitive ownership via position
CREATE POLICY "Users can select own evaluations"
  ON evaluations FOR SELECT
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own evaluations"
  ON evaluations FOR INSERT
  WITH CHECK (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own evaluations"
  ON evaluations FOR UPDATE
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()))
  WITH CHECK (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own evaluations"
  ON evaluations FOR DELETE
  USING (position_id IN (SELECT id FROM positions WHERE user_id = auth.uid()));

-- Storage bucket for CV PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cvs', 'cvs', false, 5242880, ARRAY['application/pdf']);
```

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- No SQL syntax errors in migration file
- All three tables exist with correct columns: verify via `npx supabase db lint`

#### Manual Verification:

- In Supabase Studio (localhost:54323), confirm tables are visible with correct columns and types
- RLS is shown as enabled on all three tables
- Storage bucket `cvs` is visible in Storage section

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: TypeScript Types

### Overview

Create `src/types.ts` with interfaces matching the database schema. These types will be imported by API routes and components in downstream slices.

### Changes Required:

#### 1. TypeScript type definitions

**File**: `src/types.ts` (new file)

**Intent**: Define TypeScript interfaces for database entities and the JSONB structures they contain (requirements, candidate scores, ranking, questions). These are the shared DTOs used across the application.

**Contract**:

Exports:
- `SeniorityLevel` — union type matching the enum: `'junior' | 'mid' | 'senior' | 'lead' | 'principal'`
- `Requirement` — shape of each requirement object: `{ name: string; description?: string }`
- `Position` — matches positions table columns
- `Candidate` — matches candidates table columns
- `CandidateScore` — shape within `evaluations.candidate_scores`: `{ candidate_id: string; scores: { requirement: string; score: number; comment: string }[]; overall_fit: number }`
- `Ranking` — shape within `evaluations.ranking`: `{ best_match: string | null; option_b: string | null; reasoning: string }`
- `InterviewQuestion` — shape within `evaluations.questions`: `{ question: string; category: string; rationale: string }`
- `Evaluation` — matches evaluations table columns with typed JSONB fields

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Types are importable from `@/types` in any file within `src/`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Verification

### Overview

Verify RLS policies work correctly by running test queries against the local Supabase instance — ensuring users can only access their own data.

### Changes Required:

#### 1. RLS verification script

**File**: `supabase/tests/rls_verification.sql` (new file, test-only)

**Intent**: SQL script that creates two test users, inserts positions/candidates/evaluations for each, and verifies cross-user access is blocked. Run manually against local Supabase to confirm RLS correctness.

**Contract**: The script should:
1. Create test data for two different user IDs
2. SET ROLE to authenticated + set `request.jwt.claims` to simulate user A
3. SELECT from positions/candidates/evaluations and verify only user A's data is returned
4. Attempt INSERT/UPDATE/DELETE on user B's data and verify they fail
5. Output PASS/FAIL for each check

### Success Criteria:

#### Automated Verification:

- Migration still applies cleanly after any adjustments: `npx supabase db reset`
- Build still passes: `npm run build`

#### Manual Verification:

- Run `psql` against local Supabase and execute the verification script
- All RLS checks pass — user A cannot see/modify user B's data
- Storage bucket `cvs` rejects non-PDF uploads (test via Supabase Studio or API)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Not applicable — this change is pure schema/types with no application logic.

### Integration Tests:

- RLS verification script confirms data isolation between users.
- Migration applies cleanly on fresh database (`npx supabase db reset`).

### Manual Testing Steps:

1. Run `npx supabase db reset` — should complete without errors.
2. Open Supabase Studio at localhost:54323 and confirm tables/columns/RLS.
3. Run the RLS verification SQL script and confirm all checks pass.
4. Attempt to upload a non-PDF to the `cvs` bucket — should be rejected.
5. Import `@/types` in a scratch file and confirm TypeScript autocompletion works.

## Performance Considerations

- Index on `positions.user_id` ensures RLS policy checks are fast.
- Index on `candidates.position_id` ensures the subquery in candidates/evaluations RLS is fast.
- JSONB columns (`requirements`, `candidate_scores`, `ranking`, `questions`) are read as whole documents — no need for GIN indexes at MVP scale.

## Migration Notes

- This is the first migration — no existing data to handle.
- Forward-only: if schema changes are needed later (e.g., AI evaluation reveals new fields), create a new migration rather than editing this one.
- The `evaluations.position_id` UNIQUE constraint means re-evaluation overwrites (UPSERT pattern in S-03).

## References

- PRD: `context/foundation/prd.md` — FR-001, FR-003, FR-004, data isolation NFR
- Roadmap: `context/foundation/roadmap.md` — F-01 definition (lines 61-72)
- Supabase client: `src/lib/supabase.ts:5`
- Auth middleware: `src/middleware.ts:12`
- Supabase config: `supabase/config.toml`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration — Schema & RLS

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — a38771c
- [x] 1.2 No SQL syntax errors in migration file — a38771c
- [x] 1.3 All three tables exist with correct columns: `npx supabase db lint` — a38771c

#### Manual

- [x] 1.4 Tables visible in Supabase Studio with correct columns and types — a38771c
- [x] 1.5 RLS shown as enabled on all three tables — a38771c
- [x] 1.6 Storage bucket `cvs` visible in Storage section — a38771c

### Phase 2: TypeScript Types

#### Automated

- [x] 2.1 TypeScript compiles without errors: `npm run build` — b058836
- [x] 2.2 Linting passes: `npm run lint` — b058836

#### Manual

- [x] 2.3 Types importable from `@/types` in any file within `src/` — b058836

### Phase 3: Verification

#### Automated

- [x] 3.1 Migration applies cleanly after adjustments: `npx supabase db reset` — d3a7b35
- [x] 3.2 Build still passes: `npm run build` — d3a7b35

#### Manual

- [x] 3.3 RLS verification script passes — user A cannot see/modify user B's data — d3a7b35
- [x] 3.4 Storage bucket `cvs` rejects non-PDF uploads — d3a7b35
