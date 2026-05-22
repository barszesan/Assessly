---
project: "Assessly"
version: 1
status: draft
created: 2026-05-22
context_type: brownfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

Assessly is an SSR web application built with Astro 6, React 19 interactive islands, Tailwind 4, Supabase (auth + database + storage), shadcn/ui components, and deployed to Cloudflare Workers. It currently implements a candidate-first evaluation flow (upload one CV, match against a job description). The system serves a small internal recruiting team. Auth is email + password or OAuth (Google) via Supabase with a flat user model (no roles).

The entire tech stack, auth system, UI component library, and deployment infrastructure are preserved. All product-specific features (candidate upload, single-candidate evaluation, job description management) are replaced with a position-first flow.

## Problem Statement & Motivation

Recruiters on a small team spend too much time manually reviewing CVs and matching them to open positions. When multiple candidates apply, comparing them is manual and error-prone. It's also difficult to come up with interview questions that accurately test a candidate's knowledge at the right level for a specific role.

Existing tools fragment the workflow — ATS platforms are expensive and bloated, LinkedIn Recruiter doesn't compare candidates or generate questions, and general-purpose AI assistants require manual prompting per candidate with no structured tracking. The current system's candidate-first flow doesn't match the real workflow: positions come first, then CVs arrive over time.

The current workaround is reviewing each CV manually against position requirements, maintaining mental comparisons across candidates, and crafting interview questions from scratch — costing significant time per hiring round.

## User & Persona

**Primary persona:** Recruiter / hiring manager on the team. Opens positions, collects CVs over time, needs to quickly identify the best-fit candidate(s) and prepare targeted interview questions — without manually reading and comparing every CV against requirements.

This change affects existing users of the current system — they move from a candidate-first flow to a position-first flow. No new user roles are introduced.

## Success Criteria

### Primary
- Recruiter completes the full flow (create position → upload CVs → get ranking + questions) in a single session.
- 80% of candidates identified as top match by AI pass the first recruitment stage.

### Secondary
- Time to evaluate a batch of candidates drops significantly vs. manual CV review.

### Guardrails
- AI must not produce biased or discriminatory evaluations (gender, ethnicity, age, etc.).
- Uploaded PDFs must not be accessible to other users (strict per-user data isolation).
- Existing auth system must continue working unchanged.

## User Stories

### US-01: Recruiter evaluates multiple candidates for a position

- **Given** a logged-in recruiter with an open position (structured requirements + seniority)
- **When** they upload 3+ CVs (PDF), confirm extractions, and trigger AI evaluation
- **Then** they see a ranking of candidates against requirements, with best match + option B highlighted, plus 5 interview questions for the position

### US-02: Recruiter evaluates a single candidate

- **Given** a logged-in recruiter with an open position and 1 uploaded CV
- **When** they trigger AI evaluation
- **Then** they see an individual fit assessment (not a ranking) with per-requirement scoring, and the AI may indicate the candidate doesn't meet the bar

## Scope of Change

### Position Management
- [new] Create an open position with a structured requirements list (not free-text prose) and seniority level.
  > Socrates: Counter-argument considered: "Free-text requirements are ambiguous — AI can't reliably extract criteria from unstructured prose." Resolution: force structured requirements list so AI has explicit criteria to evaluate against.

- [new] View, edit, and delete open positions. Editing a position after evaluation triggers a warning that results may be stale.
  > Socrates: Counter-argument considered: "Editing after evaluation invalidates results." Resolution: warn but allow editing — don't lock the position.

### CV Management
- [new] Upload one or more CVs (PDF) to an open position, with an extraction preview/confirmation step after upload.
  > Socrates: Counter-argument considered: "PDF text extraction is unreliable for complex layouts." Resolution: add extraction preview so recruiter can confirm/correct extracted text before evaluation.

### AI Evaluation
- [new] Request AI evaluation that: for 1 CV — individual fit assessment only (no ranking); for 2 CVs — AI picks the better match (no option B); for 3+ CVs — AI picks best match + option B. AI can reject all candidates if none meet minimum bar.
  > Socrates: Counter-argument considered: "Ranking is meaningless with <3 CVs." Resolution: tiered behavior — individual assessment for 1, pick better for 2, full ranking with option B for 3+.

- [new] View 5 AI-generated interview questions based on position requirements and seniority level (questions are per-position, not per-candidate).
  > Socrates: Counter-argument considered: "Per-candidate questions double AI cost and output." Resolution: questions are generated for the position based on requirements and seniority, not tailored to individual candidates.

### Authentication
- [preserved] Sign up / log in via email or OAuth. No changes to auth flow.

## Constraints & Compatibility

- **Backward compatibility:** No external API consumers exist. No URL contracts to preserve beyond auth routes.
- **Data migration:** No data migration needed — previous product features (book recommendations) are fully replaced. Existing user accounts persist; product-specific tables are dropped and replaced.
- **Existing integrations:** Auth provider integration must continue working unchanged.
- **Preserved behavior:** Authentication flow (email + OAuth), user session management, and per-user data isolation patterns must not change.

## Business Logic Changes

This is a new domain rule replacing the prior single-candidate evaluation:

Assessly extracts text from uploaded CVs (PDF), scores each candidate per-requirement against a position's structured requirements list, ranks candidates comparatively (tiered by CV count: 1 = individual fit assessment, 2 = pick better match, 3+ = best match + option B), and generates 5 interview questions targeting the position's requirements at the stated seniority level. AI can reject all candidates if none meet minimum fitness.

The rule consumes: a position's structured requirements list + seniority level, and one or more extracted CV texts. It produces: per-requirement fit/gap scores per candidate, a comparative ranking (tiered), an optional rejection verdict, and 5 position-level interview questions. The recruiter encounters this when they trigger "Evaluate" on a position with uploaded CVs.

## Access Control Changes

No access control changes — current model preserved. Flat user model (email + OAuth login), each user sees only their own positions, candidates, and evaluations. No admin role, no team sharing in MVP.

## Non-Goals

- No mobile app — web only for MVP. Rationale: constrain surface to one platform.
- No other document formats — PDF only for CVs. Rationale: simplify extraction; DOCX/images deferred.
- No live coding task generation. Rationale: evaluation + questions are the v1 scope.
- No candidate self-service (candidates never log in). Rationale: internal tool for recruiters only.
- No ATS integration (no importing from other recruitment tools). Rationale: standalone tool for v1.
- No team/org sharing of positions between users. Rationale: flat user model for MVP; collaboration deferred.

## Open Questions

No open questions — all elements resolved during shaping.
