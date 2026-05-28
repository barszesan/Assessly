# Position Management — Plan Brief

> Full plan: `context/changes/position-management/plan.md`

## What & Why

Implement full CRUD for positions — the core entity in Assessly's position-first evaluation flow. Recruiters need to create positions with structured requirements before they can upload CVs and trigger AI evaluation. This slice (S-01) also establishes the service layer, API conventions, and form patterns that S-02 and S-03 will reuse.

## Starting Point

The database schema is in place (F-01 complete): `positions` table with RLS, TypeScript types exported from `src/types.ts`. The app has auth (email + OAuth), middleware-based route protection, and a placeholder dashboard. No service layer, no zod validation, no form inputs beyond auth, and only a `Button` from shadcn/ui installed.

## Desired End State

A logged-in recruiter lands on `/positions` after sign-in, sees their positions as a card grid (or an empty state CTA), can create/edit positions with a tag-style requirements editor, gets a stale-results warning if editing after evaluation, and can delete positions with confirmation. The API layer is fully JSON-based with structured error responses.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|----------|--------|-------------------|
| Navigation | Dedicated `/positions` route | Clean separation from future features; dashboard redirects here. |
| API pattern | REST file routes (`/api/positions/` + `/api/positions/[id]`) | Idiomatic Astro, clear URL mapping, scalable to future resources. |
| Form submission | Fetch + JSON API | Better UX (no reload), supports dynamic requirements editor naturally. |
| Requirements UX | Tag-style add/remove with expandable description | Lightweight, fast input; optional description per requirement without clutter. |
| Stale evaluation | Inline banner warning (non-blocking) | Simple, non-intrusive; doesn't block workflow for minor edits. |
| Positions display | Card grid (responsive 1/2/3 cols) | Scannable, modern; sufficient info density for <50 positions. |
| Error responses | Structured JSON `{ error, details? }` | Allows per-field error display in forms; convention for all future endpoints. |
| Deletion | Confirm dialog + hard delete (CASCADE) | Prevents accidents; CASCADE handles cleanup of candidates/evaluations. |

## Scope

**In scope:**
- Positions API (list, get, create, update, delete)
- Zod validation schemas for position input
- Service layer pattern (`src/lib/services/positions.ts`)
- API helper utilities (JSON responses, auth check, body parsing)
- Positions list page with card grid + empty state
- Position create/edit form with requirements editor
- Position detail/view page
- Delete confirmation dialog
- Stale-evaluation warning banner
- Navigation + redirect updates (dashboard, sign-in, home)
- Loading skeleton for list
- shadcn/ui component installation (Card, Input, Select, Badge, Dialog, Sonner, Label, Textarea)

**Out of scope:**
- Candidate upload (S-02)
- AI evaluation (S-03)
- Pagination/search
- Position status (open/closed)
- Unit/integration tests (no runner configured)
- Optimistic UI

## Architecture / Approach

Bottom-up: API first, then UI. The service layer wraps Supabase queries and is called by API routes. React islands (with `client:load`) handle interactivity; Astro pages provide the shell and server-side data fetching for edit pages. Data flows: React form → fetch → API route → service → Supabase (RLS enforced).

```
[Astro Page] → [React Island (client:load)] → fetch → [API Route] → [Service] → [Supabase + RLS]
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. API Foundation | Zod schemas, service layer, REST endpoints | First API convention — if wrong, all future slices inherit the mistake. |
| 2. UI Components & List | shadcn install, card grid, delete flow, navigation | Many new components — could break build if shadcn config differs. |
| 3. Create/Edit Form | Form with requirements editor, stale warning | Requirements editor UX complexity — tag input + expandable descriptions. |
| 4. Integration & Polish | Redirects, loading states, detail page, flow polish | Edge cases in redirect logic (signed-in vs not, various entry points). |

**Prerequisites:** F-01 (database schema) must be deployed — already complete.
**Estimated effort:** ~2-3 sessions across 4 phases.

## Open Risks & Assumptions

- Assumes shadcn/ui "new-york" style installs cleanly with Tailwind 4 CSS-only config (no `tailwind.config.js`).
- No test runner — manual verification only. Bugs may not surface until integration.
- Requirements editor is the most complex UI component — may need iteration on UX after first implementation.

## Success Criteria (Summary)

- Recruiter completes full CRUD flow (create, view, edit, delete) without errors.
- API returns structured validation errors that display per-field in the form.
- Stale-evaluation warning appears on edit when evaluation exists.
