---
project: "Assessly"
version: 1
status: draft
created: 2026-05-21
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

NextChapter is a book recommendation web application built as an Astro 6 SSR application with React 19 interactive islands, Tailwind 4, Supabase for auth and database, shadcn/ui components, and deployed to Cloudflare Workers. It currently serves a single user (the developer) who rates books and receives AI-generated reading recommendations. The existing auth system (email + password / OAuth), UI component library, layout shell, and deployment infrastructure are fully operational.

## Problem Statement & Motivation

Recruiters on a small team spend too much time manually reviewing CVs and matching them to open positions. It is also difficult to come up with interview questions that accurately test a candidate's knowledge of a specific topic at the appropriate level.

Existing tools fragment this workflow: ATS platforms are expensive and bloated for a small team, LinkedIn Recruiter does not generate interview questions, and general-purpose AI (e.g., chat interfaces) requires manual prompting each time with no structured candidate tracking. No single tool combines CV upload, job description matching, AI evaluation, and targeted question generation in one flow.

The current workaround is manual: read the CV, mentally compare it to the job description, and brainstorm questions from scratch. The cost is time — minutes per candidate that compound across dozens of applicants per role.

## User & Persona

**Primary persona:** Recruiter / hiring manager on the team. Reviews candidates for open positions, needs to quickly assess fit and prepare for interviews. Limited time per candidate — wants a confident evaluation and ready-to-use questions without manual analysis. This is the same user who currently has an account in the system (auth is preserved).

## Success Criteria

### Primary
- 80% of candidates identified as matching a role by AI evaluation pass the first recruitment stage.
- Recruiter completes the full flow (upload CV, select job description, receive evaluation + questions) in a single session.

### Secondary
- Time to evaluate a candidate drops significantly compared to manual CV review.

### Guardrails
- AI must not produce biased or discriminatory evaluations.
- Existing authentication and user data must not break during the pivot.
- AI evaluation and question generation response appears within 15 seconds of submission.

## User Stories

### US-01: Recruiter evaluates a candidate for a role

- **Given** a logged-in recruiter with at least one job description saved
- **When** they upload a candidate's CV (text) and select a job description
- **Then** they see an AI evaluation scoring the candidate against each requirement from the job description, highlighting gaps, and 5 interview questions targeting those identified gaps

## Scope of Change

- [new] Recruiter can upload a CV (text format) which becomes the candidate profile — uploading creates the candidate record directly.
- [new] Recruiter can add a job description (text format or reusable template).
- [new] Recruiter can request AI evaluation of candidate-role fit — evaluation scores against explicit requirements extracted from the job description.
- [new] Recruiter can view 5 AI-generated interview questions targeting skill gaps identified in the evaluation.
- [removed] Book recommendation features (bookshelf, ratings, AI book recommendations, book search) — replaced by recruitment features.
- [preserved] Authentication flow (email + password / OAuth sign-up and login).

## Constraints & Compatibility

- The entire existing tech stack is preserved — only product-specific features change.
- The authentication flow must continue working unchanged; existing user accounts remain valid.
- No existing external integrations, APIs, or data contracts need to be respected beyond auth — the book-related database tables are replaced by recruitment-domain tables.
- No data migration is needed — existing book/recommendation data can be dropped without consequence.
- No backward compatibility concerns for end users — the sole user is the developer/team pivoting the product.

## Business Logic Changes

Assessly scores a candidate's CV against a job description's explicit requirements, identifies fit and gap areas per requirement, and generates interview questions that probe the identified skill gaps.

The rule consumes: a candidate's CV (text) and a job description (text with explicit requirements). It produces: a per-requirement fit/gap assessment and 5 interview questions targeting the weakest areas. The recruiter encounters this rule when they submit a CV against a job description and trigger the evaluation.

This is entirely new domain logic — the previous business logic (book genre preference inference and recommendation) is removed completely.

## Access Control Changes

No access control changes — current model preserved. Email + password or OAuth login. Flat user model — all users are equal; each sees only their own candidates and evaluations. No admin role in MVP.

## Non-Goals

- No mobile app — web only for MVP. Rationale: constrain the surface to one platform; mobile adds deployment and UX complexity.
- No live coding task generation. Rationale: explicitly deferred; CV evaluation + interview questions are the v1 scope.
- No candidate self-service (candidates never log in). Rationale: internal tool for recruiters only.
- No ATS integration (no importing from other recruitment tools). Rationale: standalone tool for v1; integrations add complexity without proving the core value.

## Open Questions

No open questions — all shape-notes signals were fully captured and the quality cross-check passed with no gaps.
