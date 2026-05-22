---
project: "Assessly"
context_type: brownfield
created: 2026-05-22
updated: 2026-05-22
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "change category"
      decision: "product pivot — same stack, new position-first flow"
    - topic: "must preserve"
      decision: "tech stack + auth only; all product features/UI/data can be replaced"
    - topic: "CV format"
      decision: "PDF only for CVs"
    - topic: "insight"
      decision: "fragmented tools — no single flow combines position + multiple CVs + comparison + questions"
  frs_drafted: 6
  quality_check_status: accepted
---

## Current System

Assessly — an Astro 6 SSR application with React 19 interactive islands, Tailwind 4, Supabase auth, and shadcn/ui components, deployed to Cloudflare Workers. Currently deployed with a candidate-first evaluation flow. The entire tech stack, auth system, and deployment infrastructure are preserved. All product-specific features (candidate upload, single-candidate evaluation) are replaced with a position-first flow.

## Vision & Problem Statement

Recruiters on a small team spend too much time manually reviewing CVs and matching them to open positions. When multiple candidates apply, comparing them is manual and error-prone. It's also difficult to come up with interview questions that accurately test a candidate's knowledge at the right level for a specific role.

**Insight:** Existing tools fragment the workflow — ATS platforms are expensive and bloated, LinkedIn Recruiter doesn't compare candidates or generate questions, and ChatGPT requires manual prompting per candidate with no structured tracking. Assessly combines open position creation + multiple CV uploads (PDF) + AI comparative ranking + targeted question generation in one flow.

## User & Persona

**Primary persona:** Recruiter / hiring manager on your team. Opens positions, collects CVs, needs to quickly identify the best-fit candidate(s) and prepare targeted interview questions — without manually reading and comparing every CV against requirements.

## Access Control

No changes planned — current model preserved. Email + password or OAuth (Google) login via Supabase. Flat user model — all users are equal; each sees only their own positions, candidates, and evaluations. No admin role, no team sharing in MVP.

## Success Criteria

### Primary
- Recruiter completes the full flow (create position → upload CVs → get ranking + questions) in a single session.
- 80% of candidates identified as top match by AI pass the first recruitment stage.

### Secondary
- Time to evaluate a batch of candidates drops significantly vs. manual CV review.

### Guardrails
- AI must not produce biased or discriminatory evaluations (gender, ethnicity, age, etc.).
- Uploaded PDFs must not be accessible to other users (strict data isolation).

## Functional Requirements

### Authentication
- FR-006: Recruiter can sign up / log in via email or OAuth. Priority: must-have. Change: preserved
  > Socrates: No challenge — auth is preserved as-is from the existing system.

### Position Management
- FR-001: Recruiter can create an open position with a structured requirements list (not free-text prose) and seniority level. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "Free-text requirements are ambiguous — AI can't reliably extract criteria from unstructured prose." Resolution: force structured requirements list so AI has explicit criteria to evaluate against.

- FR-002: Recruiter can view, edit, and delete their open positions. Editing a position after evaluation triggers a warning that results may be stale. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "Editing after evaluation invalidates results." Resolution: warn but allow editing — don't lock the position.

### CV Management
- FR-003: Recruiter can upload one or more CVs (PDF) to an open position, with an extraction preview/confirmation step after upload. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "PDF text extraction is unreliable for complex layouts." Resolution: add extraction preview so recruiter can confirm/correct extracted text before evaluation.

### AI Evaluation
- FR-004: Recruiter can request AI evaluation that: for 1 CV — individual fit assessment only (no ranking); for 2 CVs — AI picks the better match (no option B); for 3+ CVs — AI picks best match + option B. AI can reject all candidates if none meet minimum bar. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "Ranking is meaningless with <3 CVs." Resolution: tiered behavior — individual assessment for 1, pick better for 2, full ranking with option B for 3+.

- FR-005: Recruiter can view 5 AI-generated interview questions based on position requirements and seniority level (questions are per-position, not per-candidate). Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "Per-candidate questions double AI cost and output." Resolution: questions are generated for the position based on requirements and seniority, not tailored to individual candidates.

## User Stories

### US-01: Recruiter evaluates multiple candidates for a position

- **Given** a logged-in recruiter with an open position (structured requirements + seniority)
- **When** they upload 3+ CVs (PDF), confirm extractions, and trigger AI evaluation
- **Then** they see a ranking of candidates against requirements, with best match + option B highlighted, plus 5 interview questions for the position

### US-02: Recruiter evaluates a single candidate

- **Given** a logged-in recruiter with an open position and 1 uploaded CV
- **When** they trigger AI evaluation
- **Then** they see an individual fit assessment (not a ranking) with per-requirement scoring, and the AI may indicate the candidate doesn't meet the bar

## Business Logic

Assessly extracts text from uploaded CVs (PDF), scores each candidate per-requirement against a position's structured requirements list, ranks candidates comparatively (tiered by CV count: 1 = individual fit assessment, 2 = pick better match, 3+ = best match + option B), and generates 5 interview questions targeting the position's requirements at the stated seniority level. AI can reject all candidates if none meet minimum fitness.

The rule consumes: a position's structured requirements list + seniority level, and one or more extracted CV texts. It produces: per-requirement fit/gap scores per candidate, a comparative ranking (tiered), an optional rejection verdict, and 5 position-level interview questions. The recruiter encounters this when they trigger "Evaluate" on a position with uploaded CVs.

## Constraints & Preserved Behavior

- Entire tech stack preserved: Astro 6, React 19, Tailwind 4, Supabase, Cloudflare Workers, shadcn/ui.
- Auth flow (email/OAuth via Supabase) must continue working unchanged.
- No existing product data to migrate — previous features are fully replaced.
- PDF storage must respect Supabase storage RLS (user isolation).
- No backward compatibility needed for API consumers — no external integrations exist.

## Non-Functional Requirements

- AI evaluation + question generation response appears within 30 seconds of submission.
- Maximum PDF upload size: 5MB per file.
- Maximum CVs per position: 10.
- Uploaded PDFs accessible only to the owning user (strict data isolation via Supabase RLS).

## Non-Goals

- No mobile app — web only for MVP. Rationale: constrain surface to one platform.
- No other document formats — PDF only for CVs. Rationale: simplify extraction; DOCX/images deferred.
- No live coding task generation. Rationale: evaluation + questions are the v1 scope.
- No candidate self-service (candidates never log in). Rationale: internal tool for recruiters only.
- No ATS integration (no importing from other recruitment tools). Rationale: standalone tool for v1.
- No team/org sharing of positions between users. Rationale: flat user model for MVP; collaboration deferred.

## Quality cross-check

All elements present. No gaps identified.
