---
project: "Assessly"
context_type: brownfield
created: 2026-05-21
updated: 2026-05-21
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
    - topic: "must preserve"
      decision: "entire tech stack preserved — only product features replaced"
    - topic: "change category"
      decision: "full product pivot — same stack, new domain"
    - topic: "primary persona scope"
      decision: "yourself / your recruiting team (internal tool)"
    - topic: "insight"
      decision: "fragmented workflow — no tool combines CV + JD + question generation in one flow"
    - topic: "auth model"
      decision: "no change — existing email/OAuth flat model preserved"
    - topic: "business logic"
      decision: "score per requirement + gap-targeted questions"
  frs_drafted: 5
  quality_check_status: accepted
---

## Current System

NextChapter — an Astro 6 SSR application with React 19 interactive islands, Tailwind 4, Supabase auth, and shadcn/ui components, deployed to Cloudflare Workers. Currently a book recommendation app. The entire tech stack, auth system, UI kit, layout, and infrastructure are preserved. All product-specific features (bookshelf, recommendations, book search) are replaced.

## Vision & Problem Statement

Recruiters on a small team spend too much time manually reviewing CVs and matching them to open positions. It's also difficult to come up with interview questions that accurately test a candidate's knowledge at the right level for a specific role.

**Insight:** Existing tools fragment the workflow — ATS platforms are expensive and bloated, LinkedIn Recruiter doesn't generate questions, and ChatGPT requires manual prompting each time with no structured candidate tracking. Assessly combines CV upload + job description + AI evaluation + targeted question generation in one flow.

## User & Persona

**Primary persona:** Recruiter / hiring manager on your team. Reviews candidates for open positions, needs to quickly assess fit and prepare for interviews. Limited time per candidate — wants a confident evaluation and ready-to-use questions without manual analysis.

## Access Control

No changes planned — current model preserved. Email + password or OAuth (Google) login. Flat user model — all users are equal; each sees only their own candidates and evaluations. No admin role in MVP.

## Success Criteria

### Primary
- 80% of candidates identified as matching a role by AI pass the first recruitment stage.
- Recruiter completes the full flow (upload CV → add JD → get evaluation + questions) in a single session.

### Secondary
- Time to evaluate a candidate drops significantly vs. manual CV review.

### Guardrails
- AI must not produce biased or discriminatory evaluations.
- Existing auth system and user data must not break during the pivot.

## Functional Requirements

### Authentication
- FR-005: Recruiter can sign up / log in via email or OAuth. Priority: must-have. Change: preserved
  > Socrates: No challenge — auth is preserved as-is from the existing system.

### Candidate Management
- FR-001: Recruiter can upload a CV (text format) which becomes the candidate profile. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "Separate profile adds friction — CV IS the profile." Resolution: merged; uploading a CV creates the candidate record directly.

### Job Descriptions
- FR-002: Recruiter can add a job description (text format or template). Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "PDF parsing is complex for v1." Resolution: text-only for v1. Counter-argument considered: "JDs could be reusable templates." Resolution: allow both template and free-text input.

### AI Evaluation
- FR-003: Recruiter can request AI evaluation of candidate-role fit with explicit criteria. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "AI without clear criteria is just vibes — could mislead more than help." Resolution: evaluation must reference specific skills/requirements extracted from the JD, not give a vague score.

- FR-004: Recruiter can view 5 AI-generated interview questions targeting identified skill gaps. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: "5 generic questions are useless." Resolution: questions must specifically target gaps identified in the evaluation, not generic topic questions.

## User Stories

### US-01: Recruiter evaluates a candidate for a role

- **Given** a logged-in recruiter with at least one job description saved
- **When** they upload a candidate's CV and select a job description
- **Then** they see an AI evaluation scoring the candidate against each requirement, highlighting gaps, and 5 interview questions targeting those gaps

## Business Logic

Assessly scores a candidate's CV against a job description's explicit requirements, identifies fit and gap areas per requirement, and generates interview questions that probe the identified skill gaps.

The rule consumes: a candidate's CV (text) and a job description (text with requirements). It produces: a per-requirement fit/gap assessment and 5 interview questions targeting the weakest areas. The recruiter encounters this rule when they submit a CV against a job description and click "Evaluate."

## Constraints & Preserved Behavior

- Entire tech stack preserved: Astro 6, React 19, Tailwind 4, Supabase, Cloudflare Workers, shadcn/ui.
- Auth flow (email/OAuth via Supabase) must continue working unchanged.
- No existing integrations, APIs, or data contracts to respect beyond auth — book-related tables are replaced.
- No data migrations needed — existing candidate/book data can be dropped.

## Non-Functional Requirements

- AI evaluation + question generation response appears within 15 seconds of submission.

## Non-Goals

- No mobile app — web only for MVP. Rationale: constrain surface to one platform.
- No live coding task generation. Rationale: explicitly deferred; evaluation + questions are the v1 scope.
- No candidate self-service (candidates never log in). Rationale: internal tool for recruiters only.
- No ATS integration (no importing from other recruitment tools). Rationale: standalone tool for v1; integrations add complexity.

## Quality cross-check

All elements present. No gaps identified.
