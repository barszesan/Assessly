# AI Provider Integration Implementation Plan

## Overview

Build the F-02 AI provider foundation for Assessly using OpenAI as the first concrete provider. This change adds server-only configuration, a small provider client/service seam, schema-validated smoke output, an authenticated smoke-test API route, deterministic tests with fake provider behavior, and manual live-smoke instructions.

This is intentionally not the candidate evaluation feature. It creates the safe, verifiable provider boundary that the later `ai-evaluation-and-questions` change can call.

## Current State Analysis

The app already has positions, candidates, and evaluations data scaffolding, plus CV text extraction and candidate persistence. There is no AI provider code yet: no AI env vars, no provider client, no prompt/service layer, no OpenAI/Anthropic/OpenRouter dependency, no AI API route, and no tests around provider behavior.

Existing API routes follow a consistent Astro JSON pattern: authenticate with `requireAuth`, validate inputs with zod, create a Supabase server client when database access is needed, and return shared `jsonResponse` / `errorResponse` values. Server-only secrets are declared in `astro.config.mjs` and imported from `astro:env/server` only.

## Desired End State

After this plan is complete:

- OpenAI API key and model settings are declared as server-only Astro env fields and documented in `.env.example` / README setup notes.
- A server-only AI provider module can call OpenAI with explicit timeout, max-output, and no automatic retry defaults.
- A minimal smoke contract validates provider JSON output, proving schema-safe prompt routing without sending CV or candidate data.
- An authenticated `POST /api/ai/smoke-test` endpoint returns a schema-validated success payload when OpenAI is configured, and `503` when AI config is missing.
- Unit tests cover provider response parsing and failure handling with fake fetch/provider behavior; one manual live smoke test verifies real credentials.

### Key Discoveries:

- `src/types.ts:30-57` already defines `CandidateScore`, `Ranking`, `InterviewQuestion`, and `Evaluation`, but no runtime schemas exist for provider output yet.
- `supabase/migrations/20260525120000_create_positions_candidates_evaluations.sql:48-59` already creates `evaluations` with JSONB fields and a unique `position_id`, so F-02 should not change schema.
- `src/lib/api-helpers.ts:19-42` provides zod-backed body parsing and structured validation errors for API routes.
- `src/lib/supabase.ts:3-8` imports Supabase env vars from `astro:env/server` and returns `null` when missing; AI config should follow the same fail-closed pattern for AI endpoints.
- `astro.config.mjs:27-31` is the canonical place to declare server-only secret env fields.
- `context/foundation/roadmap.md:74-86` defines F-02 as provider selection, API key config, and base prompt routing; S-03 remains responsible for candidate ranking and interview questions.
- `context/foundation/lessons.md:5-10` requires manual verification steps to be runnable as authored; smoke-test instructions must include complete commands and expected outcomes.

## What We're NOT Doing

- No candidate scoring, ranking, or interview-question generation.
- No writes to the `evaluations` table.
- No recruiter-facing evaluation UI.
- No CV, candidate, or position data sent to OpenAI in this change.
- No provider abstraction for multiple real vendors beyond a small interface seam for future extension.
- No live OpenAI call in CI; live provider verification remains manual to avoid flaky/costly CI.
- No public unauthenticated AI health endpoint.

## Implementation Approach

Implement OpenAI as the first concrete provider behind a small server-only service boundary. Keep the smoke contract intentionally tiny so the change proves configuration, request/response handling, timeout behavior, and zod validation without deciding S-03 scoring details too early. Use deterministic unit tests for parsing/failure behavior and an authenticated manual smoke endpoint for real credential verification.

## Critical Implementation Details

### Provider Runtime

Cloudflare Workers provides `fetch` and `AbortController`; prefer direct HTTP calls to OpenAI over adding an SDK unless implementation discovers the SDK is required and Worker-compatible. Keeping the provider client as a small fetch wrapper avoids Node-specific SDK assumptions and keeps tests easy to fake.

### Privacy Boundary

The smoke route must use synthetic prompt content only. Do not read candidates, positions, CV text, or evaluations in F-02; S-03 must make the explicit privacy and prompt-guardrail decisions before candidate data leaves the app.

## Phase 1: Provider Configuration and Contracts

### Overview

Add the configuration and type/runtime contracts the AI layer needs before any live provider call exists.

### Changes Required:

#### 1. Astro environment schema

**File**: `astro.config.mjs`

**Intent**: Declare OpenAI configuration as server-only env fields so secrets are never exposed to client React islands.

**Contract**: Add optional server secret env fields for `OPENAI_API_KEY` and `OPENAI_MODEL`. `OPENAI_API_KEY` is required for live AI routes at runtime; `OPENAI_MODEL` may default in server-only code if omitted.

#### 2. Environment example

**File**: `.env.example`

**Intent**: Document the OpenAI variables needed for local development and Cloudflare secrets.

**Contract**: Add placeholder entries for `OPENAI_API_KEY` and `OPENAI_MODEL`, keeping existing Supabase entries intact.

#### 3. Configuration status

**File**: `src/lib/config-status.ts`

**Intent**: Surface whether AI provider config is present alongside existing Supabase configuration status.

**Contract**: Add an `OpenAI` status using server-only env imports. Missing OpenAI config should not block the whole app, but AI-specific routes must be able to fail with `503`.

#### 4. AI schemas

**File**: `src/lib/schemas/ai.ts`

**Intent**: Define the minimal runtime contract for F-02 smoke output and keep future provider validation colocated with other zod schemas.

**Contract**: Export a zod schema and inferred type for a minimal smoke response shaped like `{ ok: true, message: string }`. The schema should be strict enough to reject malformed provider output.

#### 5. Provider interface types

**File**: `src/lib/ai/types.ts`

**Intent**: Define the narrow service boundary future evaluation code can call without importing provider-specific OpenAI details.

**Contract**: Export types/interfaces for provider configuration, smoke-test result, and provider errors. Keep the interface minimal and focused on F-02; do not include candidate evaluation contracts yet.

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- Linting passes: `npm run lint`
- AI env fields are server-only in `astro.config.mjs`

#### Manual Verification:

- Confirm `.env.example` lists `OPENAI_API_KEY` and `OPENAI_MODEL` without real secrets.
- Confirm no OpenAI env imports appear in client React components under `src/components/**/*.tsx`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: OpenAI Client and Authenticated Smoke Route

### Overview

Implement the real OpenAI provider seam and an authenticated API route that verifies prompt routing end-to-end without using candidate data.

### Changes Required:

#### 1. OpenAI provider client

**File**: `src/lib/ai/openai.ts`

**Intent**: Encapsulate the server-only HTTP call to OpenAI, including timeout, max-output limit, JSON response parsing, and mapping provider failures to typed errors.

**Contract**: Export a function that runs the minimal smoke prompt against OpenAI and returns the validated smoke response type. It must read secrets only from server-only config passed into the module or imported from `astro:env/server`, use explicit conservative limits, and avoid automatic retries in F-02.

#### 2. AI provider service

**File**: `src/lib/services/ai.ts`

**Intent**: Provide the application-level AI service boundary used by API routes and future S-03 code.

**Contract**: Export a `runAiSmokeTest()`-style function that checks provider configuration, calls the OpenAI client, and returns a typed result or typed failure. Missing config must be distinguishable from provider/network/schema failures so routes can return the correct status.

#### 3. Smoke-test API route

**File**: `src/pages/api/ai/smoke-test.ts`

**Intent**: Add an authenticated route for humans/agents to verify live provider configuration and base prompt routing.

**Contract**: `POST /api/ai/smoke-test` must use `requireAuth(context.locals)`, return `401` when unauthenticated, return `503` when OpenAI config is missing, return `502` or `500` for provider/schema failures, and return JSON success for a validated smoke response. It must not read Supabase, candidates, positions, or CV text.

#### 4. API documentation notes

**File**: `README.md`

**Intent**: Document local OpenAI setup and the authenticated smoke-test verification path.

**Contract**: Add a concise AI provider configuration section explaining `.env` / `.dev.vars` variables and how to run the smoke endpoint after signing in locally.

### Success Criteria:

#### Automated Verification:

- TypeScript build passes: `npm run build`
- Linting passes: `npm run lint`
- Route file exports `prerender = false` and uppercase `POST`

#### Manual Verification:

- With no `OPENAI_API_KEY`, run an authenticated `POST /api/ai/smoke-test` and confirm HTTP `503` with an error message indicating AI provider config is missing.
- With valid OpenAI credentials in `.dev.vars`, run an authenticated `POST /api/ai/smoke-test` and confirm HTTP `200` with `{ "ok": true, "message": "..." }` or equivalent schema-valid JSON.
- Confirm the smoke request uses synthetic content only and does not include any candidate/CV data.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 3: Deterministic Tests and Live Verification Docs

### Overview

Add deterministic automated coverage for the provider boundary and make manual live-smoke verification runnable exactly as written.

### Changes Required:

#### 1. Provider tests

**File**: `src/lib/ai/openai.test.ts`

**Intent**: Cover parsing and failure behavior without making live OpenAI calls.

**Contract**: Use Vitest with fake fetch/provider responses to test valid schema output, malformed JSON/schema rejection, provider HTTP failure, timeout/abort behavior if exposed cleanly, and missing configuration behavior through the service boundary.

#### 2. Test setup if needed

**File**: `vitest.config.ts` or package-level test configuration only if required

**Intent**: Ensure Vitest can run TypeScript tests with the existing `@/*` alias.

**Contract**: Add the smallest required config. Do not introduce broad test infrastructure beyond what `npm run test` needs for this provider unit test.

#### 3. Manual smoke instructions

**File**: `README.md`

**Intent**: Make live verification steps copy-pasteable and aligned with the repository lesson about runnable manual checks.

**Contract**: Include complete steps for starting local dev, signing in, sending an authenticated `POST /api/ai/smoke-test`, and expected statuses for missing-config and configured-provider cases. If curl requires cookies, document how to use the browser/devtools or an HTTP client with the active session cookie rather than leaving it vague.

#### 4. Change notes

**File**: `context/changes/ai-provider-integration/change.md`

**Intent**: Keep the change identity accurate after planning.

**Contract**: Status remains `planned`, title is `AI provider integration`, and notes remain the seed area only.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- TypeScript build passes: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- Follow README missing-config smoke steps and observe the documented `503` response.
- Follow README configured-provider smoke steps with valid OpenAI credentials and observe a schema-valid `200` response.
- Inspect the implementation and confirm no CV/candidate/position content is sent to OpenAI in this change.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Unit Tests:

- OpenAI provider client parses a valid schema-shaped JSON response.
- OpenAI provider client rejects malformed JSON or schema-invalid output.
- Provider/service layer distinguishes missing config from provider/network/schema failures.
- Timeout/abort behavior is covered if the implementation exposes it in a testable way.

### Integration Tests:

- No live OpenAI integration test in CI. Manual smoke verification covers real credentials and provider reachability.
- The authenticated API route can be manually exercised in local dev with and without `OPENAI_API_KEY`.

### Manual Testing Steps:

1. Start the app locally with Supabase configured and no `OPENAI_API_KEY`.
2. Sign in through the browser.
3. Send an authenticated `POST /api/ai/smoke-test` using the active session cookie.
4. Confirm the response is HTTP `503` and says AI provider config is missing.
5. Add `OPENAI_API_KEY` and `OPENAI_MODEL` to `.dev.vars`, restart dev server, and sign in again if needed.
6. Send the same authenticated `POST /api/ai/smoke-test`.
7. Confirm the response is HTTP `200` and matches the smoke schema.
8. Confirm the request body/prompt path uses synthetic smoke-test content only.

## Performance Considerations

- The smoke call should use a very small prompt and conservative output token limit.
- The provider client should enforce an explicit timeout suitable for Cloudflare request handling.
- No automatic retries in F-02; retries can multiply latency and cost and should be decided during S-03 if needed.
- No provider call should happen during page render or app startup; calls happen only when the authenticated smoke endpoint is invoked.

## Migration Notes

- No database migration is required.
- No changes to `evaluations` schema or RLS policies are needed.
- Deployment requires setting OpenAI secrets in the target Cloudflare environment before live smoke testing.

## References

- Roadmap F-02: `context/foundation/roadmap.md:74-86`
- Roadmap S-03 boundary: `context/foundation/roadmap.md:126-136`
- API helpers: `src/lib/api-helpers.ts:5-49`
- Server env schema: `astro.config.mjs:27-31`
- Server-only Supabase env import pattern: `src/lib/supabase.ts:1-8`
- Existing config status: `src/lib/config-status.ts:1-21`
- Evaluation types scaffold: `src/types.ts:30-57`
- Evaluations table schema: `supabase/migrations/20260525120000_create_positions_candidates_evaluations.sql:48-59`
- Manual verification lesson: `context/foundation/lessons.md:5-10`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Provider Configuration and Contracts

#### Automated

- [x] 1.1 TypeScript build passes: `npm run build` — 2fb598c
- [x] 1.2 Linting passes: `npm run lint` — 2fb598c
- [x] 1.3 AI env fields are server-only in `astro.config.mjs` — 2fb598c

#### Manual

- [x] 1.4 `.env.example` lists OpenAI placeholders without real secrets — 2fb598c
- [x] 1.5 No OpenAI env imports appear in client React components — 2fb598c

### Phase 2: OpenAI Client and Authenticated Smoke Route

#### Automated

- [x] 2.1 TypeScript build passes: `npm run build` — 82c6bf0
- [x] 2.2 Linting passes: `npm run lint` — 82c6bf0
- [x] 2.3 Smoke route exports `prerender = false` and uppercase `POST` — 82c6bf0

#### Manual

- [x] 2.4 Missing OpenAI config returns authenticated smoke-test HTTP `503` — 82c6bf0
- [x] 2.5 Valid OpenAI config returns schema-valid smoke-test HTTP `200` — 82c6bf0
- [x] 2.6 Smoke route uses synthetic content only and no candidate/CV data — 82c6bf0

### Phase 3: Deterministic Tests and Live Verification Docs

#### Automated

- [x] 3.1 Unit tests pass: `npm run test` — 495c2b7
- [x] 3.2 TypeScript build passes: `npm run build` — 495c2b7
- [x] 3.3 Linting passes: `npm run lint` — 495c2b7

#### Manual

- [x] 3.4 README missing-config smoke steps produce documented `503` — 495c2b7
- [x] 3.5 README configured-provider smoke steps produce schema-valid `200` — 495c2b7
- [x] 3.6 No CV/candidate/position content is sent to OpenAI in this change — 495c2b7
