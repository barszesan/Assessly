# AI Provider Integration — Plan Brief

> Full plan: `context/changes/ai-provider-integration/plan.md`

## What & Why

Build the AI provider foundation for Assessly using OpenAI as the first concrete provider. This unblocks the later AI evaluation slice by proving server-only configuration, provider calls, schema validation, and an authenticated smoke-test path without prematurely implementing candidate scoring.

## Starting Point

Positions, candidates, CV extraction, and the `evaluations` table already exist. There is no AI provider layer yet: no OpenAI env vars, no provider client, no prompt-routing service, no AI API route, and no provider tests.

## Desired End State

The app has a server-only OpenAI provider seam with conservative timeout/token limits and no automatic retries. An authenticated `POST /api/ai/smoke-test` route proves live provider wiring using synthetic content only, returning `503` when config is missing and schema-valid JSON when configured.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| First provider | OpenAI | Best fit for simple structured-output support and lightweight HTTP integration. |
| Change scope | Provider foundation only | Keeps F-02 focused and leaves persisted candidate evaluation to S-03. |
| Output contract | Minimal smoke schema | Proves schema validation without deciding scoring/ranking details too early. |
| Smoke API | Authenticated dev smoke endpoint | Enables end-to-end verification without public exposure or UI work. |
| Missing config | Fail closed with `503` | Matches existing service-unavailable behavior and avoids fake success. |
| Cost/latency | Explicit small limits | Prevents runaway provider cost and Cloudflare request latency. |
| Testing | Unit fake + manual live smoke | Keeps CI deterministic while still proving real credentials manually. |
| Privacy | No CV data in F-02 | Avoids sending candidate data before S-03 privacy guardrails are planned. |

## Scope

**In scope:**

- Server-only OpenAI env schema and docs
- Minimal AI provider interface and OpenAI HTTP client
- Schema-validated smoke response
- Authenticated `POST /api/ai/smoke-test`
- Deterministic Vitest coverage with fake provider/fetch behavior
- Runnable README smoke-test instructions

**Out of scope:**

- Candidate scoring, ranking, or interview-question generation
- Writes to `evaluations`
- Recruiter-facing evaluation UI
- Sending CV/candidate/position data to OpenAI
- Live provider tests in CI
- Multi-provider production abstraction

## Architecture / Approach

Add a server-only `src/lib/ai/` provider layer under an application service in `src/lib/services/ai.ts`. The API route authenticates with existing `requireAuth`, calls the AI service, maps missing config to `503`, and returns only schema-validated smoke output.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Provider Configuration and Contracts | Env schema, docs, config status, smoke schema, provider types | Secret handling must remain server-only. |
| 2. OpenAI Client and Authenticated Smoke Route | Real OpenAI call path and protected smoke endpoint | Provider failures must map cleanly without leaking details. |
| 3. Deterministic Tests and Live Verification Docs | Fake-provider tests and runnable manual smoke instructions | Manual smoke needs valid auth/session steps, not vague instructions. |

**Prerequisites:** Supabase/auth configured locally for authenticated API testing; OpenAI API key for live smoke only.
**Estimated effort:** ~2-3 focused sessions across 3 phases.

## Open Risks & Assumptions

- Direct OpenAI HTTP calls are assumed to be Cloudflare Workers-compatible; if an SDK is introduced, Worker compatibility must be verified.
- The minimal smoke schema proves the provider seam, not the future candidate-evaluation prompt quality.
- S-03 still needs explicit privacy, anti-bias, prompt, and evaluation persistence decisions.

## Success Criteria (Summary)

- Missing OpenAI config returns authenticated smoke-test HTTP `503` without breaking non-AI app flows.
- Valid OpenAI config returns schema-valid smoke JSON from `POST /api/ai/smoke-test`.
- `npm run test`, `npm run build`, and `npm run lint` pass with no client-side secret imports.
