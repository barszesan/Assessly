# Position Management Implementation Plan

## Overview

Implement full CRUD for positions — the recruiter creates a position with title, description, seniority level, and a structured requirements list; views their positions in a card grid; edits them (with stale-evaluation warning); and deletes them with confirmation. This is the first feature slice (S-01) and establishes conventions for the service layer, API routes, zod validation, error handling, and React form patterns used by all downstream slices.

## Current State Analysis

- **Database schema**: `positions` table exists with `id`, `user_id`, `title`, `description`, `seniority` (enum), `requirements` (jsonb), timestamps. RLS policies enforce per-user isolation. Created in F-01 (`supabase/migrations/20260525120000_create_positions_candidates_evaluations.sql`).
- **TypeScript types**: `Position`, `Requirement`, `SeniorityLevel` exported from `src/types.ts`.
- **No service layer**: `src/lib/services/` doesn't exist yet.
- **No zod schemas**: no validation patterns established.
- **UI minimal**: only `Button` from shadcn/ui installed. No form inputs, cards, selects, dialogs.
- **Existing patterns**: API routes export uppercase HTTP methods (`export const POST: APIRoute`), use `createClient(context.request.headers, context.cookies)` for Supabase access.
- **Middleware**: protects `/dashboard` via `PROTECTED_ROUTES` array prefix matching.
- **Dashboard**: placeholder showing email + sign-out button.

### Key Discoveries:

- `createClient()` returns `null` when env vars missing — API routes must handle this (`src/lib/supabase.ts:6-8`).
- Auth middleware stores user on `context.locals.user` — API routes can access authenticated user from `context.locals.user?.id`.
- Existing auth API routes use redirect-based flow; new position routes will use JSON request/response pattern (fetch-based).
- `evaluations` table has FK to `positions` with CASCADE — deleting a position auto-deletes evaluations. UNIQUE constraint on `evaluations.position_id` means at most one evaluation per position.

## Desired End State

After this plan is complete:
1. A logged-in recruiter can navigate to `/positions`, see their positions as a card grid (or an empty state with a CTA to create their first position).
2. They can create a new position with title, optional description, seniority level, and a structured requirements list (tag-style add/remove with optional description per requirement).
3. They can edit any position — if an evaluation exists for that position, an inline banner warns that results may be stale.
4. They can delete a position via a confirmation dialog (CASCADE removes associated candidates/evaluations).
5. API returns structured JSON errors (`{ error, details? }`) on validation failures.
6. The service layer, zod schemas, and API patterns are established as conventions for S-02 and S-03.

Verification: `npm run build` succeeds, `npm run lint` passes, positions CRUD works end-to-end in browser.

## What We're NOT Doing

- No candidate upload or evaluation — those are S-02 and S-03.
- No pagination or search — small data volume (recruiter's own positions only).
- No position status (open/closed/archived) — PRD doesn't require it for MVP.
- No shared positions between users — flat user model per PRD.
- No tests (unit or integration) — no test runner configured yet; deferred to a future health-check pass.
- No optimistic UI updates — simple loading states on submit are sufficient.

## Implementation Approach

Bottom-up: API layer first (schemas + service + routes), then UI components, then pages wiring everything together. This lets each phase be independently verifiable — API via curl/HTTP client, then UI visually.

## Phase 1: API Foundation

### Overview

Establish the service layer pattern, zod validation schemas, and REST API routes for position CRUD. After this phase, all endpoints are testable via HTTP client (curl, Postman, or VS Code REST Client).

### Changes Required:

#### 1. Zod validation schemas

**File**: `src/lib/schemas/position.ts` (new file)

**Intent**: Define request validation schemas for creating and updating positions. These schemas validate incoming JSON bodies before they reach the service layer. Establishes the zod validation convention for all future endpoints.

**Contract**:
- Export `createPositionSchema` — validates: `title` (string, 1-200 chars, trimmed), `description` (string, optional, max 2000 chars), `seniority` (enum matching `SeniorityLevel`), `requirements` (array of `{ name: string (1-100 chars), description?: string (max 500 chars) }`, min 1 item, max 20 items).
- Export `updatePositionSchema` — same as create but all fields optional (partial), with at least one field required.
- Export inferred types: `CreatePositionInput`, `UpdatePositionInput`.

#### 2. Positions service

**File**: `src/lib/services/positions.ts` (new file)

**Intent**: Encapsulate all Supabase queries for positions behind a clean async interface. The service accepts a Supabase client (already authenticated via RLS) and returns typed results. Establishes the service layer pattern.

**Contract**:
- `listPositions(supabase): Promise<Position[]>` — SELECT all for current user (RLS handles filtering), ordered by `created_at` DESC.
- `getPosition(supabase, id: string): Promise<Position | null>` — SELECT by id (RLS ensures ownership).
- `createPosition(supabase, input: CreatePositionInput, userId: string): Promise<Position>` — INSERT with user_id, return created row.
- `updatePosition(supabase, id: string, input: UpdatePositionInput): Promise<Position | null>` — UPDATE by id, return updated row or null if not found.
- `deletePosition(supabase, id: string): Promise<boolean>` — DELETE by id, return success.
- `positionHasEvaluation(supabase, id: string): Promise<boolean>` — check if evaluation exists for this position (used for stale-results warning).

#### 3. API helper for JSON error responses

**File**: `src/lib/api-helpers.ts` (new file)

**Intent**: Shared helpers for API routes — consistent JSON error/success responses and request body parsing. Establishes the error response convention: `{ error: string, details?: Record<string, string[]> }`.

**Contract**:
- `jsonResponse(data: unknown, status?: number): Response` — creates a JSON Response.
- `errorResponse(error: string, status: number, details?: Record<string, string[]>): Response` — creates error Response matching the convention.
- `parseJsonBody<T>(request: Request, schema: ZodSchema<T>): Promise<{ data: T } | { error: Response }>` — parses body, validates with zod, returns data or pre-built error response with field-level details.
- `requireAuth(locals: App.Locals): { user: User } | { error: Response }` — checks `locals.user` exists, returns 401 error response if not.

#### 4. Positions list + create endpoint

**File**: `src/pages/api/positions/index.ts` (new file)

**Intent**: Handle GET (list all positions) and POST (create position) at `/api/positions/`.

**Contract**:
- `export const prerender = false`
- `export const GET: APIRoute` — calls `listPositions`, returns JSON array.
- `export const POST: APIRoute` — parses + validates body with `createPositionSchema`, calls `createPosition`, returns 201 with created position.
- Both use `requireAuth` and `createClient` helpers. Returns 401 if not authenticated, 400 with details on validation failure, 500 on unexpected error.

#### 5. Position detail + update + delete endpoint

**File**: `src/pages/api/positions/[id].ts` (new file)

**Intent**: Handle GET (single position), PUT (update), DELETE at `/api/positions/:id`.

**Contract**:
- `export const prerender = false`
- `export const GET: APIRoute` — calls `getPosition`, returns 404 if not found.
- `export const PUT: APIRoute` — validates body with `updatePositionSchema`, calls `updatePosition`, returns 404 if not found.
- `export const DELETE: APIRoute` — calls `deletePosition`, returns 204 on success, 404 if not found.
- `id` extracted from `context.params.id`. UUID format validated.

#### 6. Position evaluation status endpoint

**File**: `src/pages/api/positions/[id]/has-evaluation.ts` (new file)

**Intent**: Lightweight endpoint to check if a position has an evaluation (used by edit form to show stale-results warning).

**Contract**:
- `export const prerender = false`
- `export const GET: APIRoute` — returns `{ hasEvaluation: boolean }`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npm run build`
- Linting passes: `npm run lint`

#### Manual Verification:

- GET `/api/positions/` returns `[]` for authenticated user (curl or REST client)
- POST `/api/positions/` with valid body returns 201 with position
- POST with invalid body returns 400 with field-level details
- GET `/api/positions/:id` returns the created position
- PUT `/api/positions/:id` updates fields
- DELETE `/api/positions/:id` returns 204
- Unauthenticated requests return 401

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: UI Components & Positions List

### Overview

Install required shadcn/ui components, build the positions list page with card grid layout, implement delete confirmation dialog, and update navigation. After this phase, users can see and delete positions.

### Changes Required:

#### 1. Install shadcn/ui components

**Intent**: Add the UI primitives needed for the positions feature. These are installed via the shadcn CLI and follow the "new-york" style already configured.

**Contract**: Run `npx shadcn@latest add card input select badge dialog sonner label textarea` — adds components to `src/components/ui/`. Also add the `<Toaster />` to the root layout.

#### 2. Positions list React component

**File**: `src/components/positions/PositionList.tsx` (new file)

**Intent**: Interactive React island that fetches and displays the user's positions as a card grid. Handles loading state, empty state (CTA to create first position), and delete flow.

**Contract**:
- Fetches positions from `GET /api/positions/` on mount.
- Renders a responsive grid (1 col mobile, 2 cols md, 3 cols lg).
- Each card shows: title, seniority badge, requirement count, created date, edit/delete action buttons.
- Delete button triggers confirmation dialog (using shadcn Dialog).
- On delete confirmation, calls `DELETE /api/positions/:id`, removes from local state, shows success toast.
- Empty state: centered message with "Create your first position" button linking to create page.
- Props: none (self-contained data fetching).

#### 3. Position card sub-component

**File**: `src/components/positions/PositionCard.tsx` (new file)

**Intent**: Presentational card component for a single position in the grid. Extracted for readability.

**Contract**:
- Props: `position: Position`, `onDelete: (id: string) => void`, `onEdit: (id: string) => void`.
- Uses Card, Badge from shadcn/ui. Seniority displayed as colored badge.

#### 4. Delete confirmation dialog component

**File**: `src/components/positions/DeletePositionDialog.tsx` (new file)

**Intent**: Confirmation dialog for position deletion. Warns that candidates and evaluations will also be removed.

**Contract**:
- Props: `open: boolean`, `onOpenChange`, `positionTitle: string`, `onConfirm: () => void`, `isDeleting: boolean`.
- Uses shadcn Dialog. Shows position title, warning text, Cancel + Delete (destructive) buttons.

#### 5. Positions list Astro page

**File**: `src/pages/positions/index.astro` (new file)

**Intent**: Astro page shell for the positions list. Uses Layout, renders the PositionList React island with `client:load`.

**Contract**: Protected route (middleware handles auth redirect). Contains page title "Positions" and a "New Position" link/button in the header area.

#### 6. Update middleware for route protection

**File**: `src/middleware.ts`

**Intent**: Add `/positions` to the protected routes array so unauthenticated users get redirected to sign-in.

**Contract**: Add `"/positions"` to `PROTECTED_ROUTES` array.

#### 7. Navigation update

**File**: `src/components/Topbar.astro`

**Intent**: Add a "Positions" link to the top navigation bar for authenticated users.

**Contract**: Link to `/positions` visible when user is logged in.

#### 8. Add Toaster to layout

**File**: `src/layouts/Layout.astro`

**Intent**: Mount the Sonner toast provider so toast notifications work across the app.

**Contract**: Import and render `<Toaster />` from sonner (via the shadcn sonner component) at the bottom of the body, with `client:load`.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Navigate to `/positions` — see empty state with CTA
- Create a position via API (curl), refresh — see it in the card grid
- Click delete — confirmation dialog appears with position title
- Confirm delete — card removed, toast shown
- Unauthenticated access to `/positions` redirects to sign-in
- Topbar shows "Positions" link when logged in

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Position Create/Edit Form

### Overview

Build the position form with title, description, seniority select, and tag-style requirements editor. Supports both create and edit modes. Shows stale-evaluation warning on edit when applicable.

### Changes Required:

#### 1. Position form React component

**File**: `src/components/positions/PositionForm.tsx` (new file)

**Intent**: Interactive form for creating/editing a position. Uses fetch to submit JSON to API. Handles validation errors (both client-side and server-returned field errors).

**Contract**:
- Props: `mode: 'create' | 'edit'`, `initialData?: Position` (for edit mode), `hasEvaluation?: boolean` (for stale warning).
- Fields: title (Input), description (Textarea, optional), seniority (Select with all 5 enum values), requirements (RequirementsEditor sub-component).
- On submit: POST to `/api/positions/` (create) or PUT to `/api/positions/:id` (edit).
- On success: redirect to `/positions` with toast.
- On validation error: display field-level errors from API response `details`.
- Client-side validation mirrors zod schema (required title, at least 1 requirement).

#### 2. Requirements editor sub-component

**File**: `src/components/positions/RequirementsEditor.tsx` (new file)

**Intent**: Tag-style editor for the requirements list. User types a requirement name, presses Enter or clicks Add, sees it as a removable chip. Optionally expands a chip to add/edit description.

**Contract**:
- Props: `value: Requirement[]`, `onChange: (reqs: Requirement[]) => void`.
- Input + "Add" button at top. Each requirement rendered as a chip/tag with X button to remove.
- Clicking a chip toggles an inline description field below it (optional, collapsible).
- Max 20 requirements enforced (add button disabled, helper text shown).
- Min 1 requirement validated by parent form on submit (not enforced in this component).

#### 3. Stale evaluation warning component

**File**: `src/components/positions/StaleEvaluationBanner.tsx` (new file)

**Intent**: Non-blocking yellow/amber banner shown at the top of the edit form when the position has been evaluated.

**Contract**:
- Props: none (purely presentational).
- Renders: warning icon + text "This position has been evaluated. Editing may invalidate results."
- Styled as a non-blocking inline alert (amber background, dark text).

#### 4. Create position Astro page

**File**: `src/pages/positions/new.astro` (new file)

**Intent**: Page shell for the create form. Renders PositionForm in create mode.

**Contract**: Protected route. Page title "New Position". Renders `<PositionForm mode="create" client:load />`.

#### 5. Edit position Astro page

**File**: `src/pages/positions/[id]/edit.astro` (new file)

**Intent**: Page shell for the edit form. Fetches position data server-side and passes to PositionForm. Also checks evaluation status for stale warning.

**Contract**:
- Protected route. Dynamic route parameter `id`.
- In frontmatter: fetch position via service (server-side), check `positionHasEvaluation`. If position not found, return 404.
- Renders `<PositionForm mode="edit" initialData={position} hasEvaluation={hasEvaluation} client:load />`.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Navigate to `/positions/new` — form renders with all fields
- Fill title, select seniority, add 2+ requirements (tag-style) — submit creates position
- Submit with empty title — client-side error shown
- Submit with no requirements — error shown
- Navigate to edit page for existing position — form pre-filled
- Edit and save — changes persist
- If position has evaluation (create one via SQL), edit page shows amber stale-results banner
- Requirements editor: add, remove, expand for description all work

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Integration & Polish

### Overview

Wire up navigation flows, add loading states, handle edge cases, and redirect dashboard to positions. After this phase, the feature is complete end-to-end.

### Changes Required:

#### 1. Dashboard redirect

**File**: `src/pages/dashboard.astro`

**Intent**: Redirect authenticated users from `/dashboard` to `/positions` since positions is now the primary view.

**Contract**: In frontmatter, return `Astro.redirect("/positions")`. Remove existing placeholder content.

#### 2. Position detail/view page

**File**: `src/pages/positions/[id]/index.astro` (new file)

**Intent**: Read-only view of a single position with all details. Entry point for future CV upload (S-02) and evaluation (S-03) features.

**Contract**:
- Fetches position server-side. Shows title, description, seniority, full requirements list (name + description).
- Action buttons: "Edit" link, "Delete" button (with confirmation dialog).
- Placeholder section for candidates (future S-02): text "No candidates uploaded yet" with disabled "Upload CVs" button.
- If evaluation exists, show a summary section (future S-03): text "Evaluation complete" (details come later).

#### 3. Loading states for list

**File**: `src/components/positions/PositionListSkeleton.tsx` (new file)

**Intent**: Skeleton/placeholder component shown while positions are loading in the list view.

**Contract**: Renders 3-6 card-shaped skeletons matching the card grid layout. Uses pulsing animation (Tailwind `animate-pulse`).

#### 4. After-login redirect update

**File**: `src/pages/api/auth/signin.ts`

**Intent**: After successful sign-in, redirect to `/positions` instead of `/` (home page).

**Contract**: Change redirect target from `"/"` to `"/positions"`.

#### 5. Home page update for authenticated users

**File**: `src/pages/index.astro`

**Intent**: If user is already authenticated and visits `/`, redirect to `/positions`.

**Contract**: In frontmatter, check `Astro.locals.user` — if present, `return Astro.redirect("/positions")`.

### Success Criteria:

#### Automated Verification:

- Build passes: `npm run build`
- Lint passes: `npm run lint`

#### Manual Verification:

- Sign in — redirected to `/positions` (not `/`)
- Visit `/` while signed in — redirected to `/positions`
- Visit `/dashboard` — redirected to `/positions`
- Positions list shows skeleton while loading
- Create a position → redirected to positions list → new position visible
- Click position card → detail page with all info
- Detail page shows edit/delete actions, placeholder for future features
- Full flow: create, view, edit, delete — all work seamlessly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Not applicable — no test runner configured. Service functions are simple Supabase wrappers; zod schemas self-validate.

### Integration Tests:

- Not applicable — deferred to health-check pass.

### Manual Testing Steps:

1. Sign in → verify redirect to `/positions`
2. Empty state shows "Create your first position" CTA
3. Create position: fill title "Senior React Developer", select "senior", add 3 requirements — verify created
4. View position detail — all fields displayed correctly
5. Edit position — change title, remove a requirement, add a new one — verify saved
6. Create evaluation via SQL INSERT, edit position — verify amber stale-results banner
7. Delete position — confirm dialog mentions title, confirm → position gone + toast
8. Sign out → visit `/positions` → redirected to sign-in
9. POST to `/api/positions/` without auth header → 401
10. POST with invalid body (missing title) → 400 with `details.title` error

## Performance Considerations

- Positions list fetches all positions for the user — acceptable at MVP scale (single recruiter, <50 positions).
- No pagination needed — if a recruiter has 50+ positions, consider infinite scroll in a future pass.
- Requirements stored as JSONB — read/write as whole document, no GIN index needed at this scale.
- Card grid uses CSS Grid — no JS layout calculations.

## Migration Notes

- No database changes — F-01 already created the schema.
- After sign-in redirect changes (Phase 4), existing signed-in sessions will still work — they'll just see `/positions` next time they navigate to `/` or `/dashboard`.

## References

- Database schema: `supabase/migrations/20260525120000_create_positions_candidates_evaluations.sql`
- Types: `src/types.ts:8-17` (Position), `src/types.ts:3-6` (Requirement), `src/types.ts:1` (SeniorityLevel)
- Supabase client: `src/lib/supabase.ts`
- Auth middleware: `src/middleware.ts`
- Existing API pattern: `src/pages/api/auth/signin.ts`
- PRD requirements: FR-001, FR-002, US-01, US-02
- Roadmap: `context/foundation/roadmap.md` — S-01 (lines 90-100)
- F-01 plan: `context/changes/database-schema-and-rls/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: API Foundation

#### Automated

- [x] 1.1 TypeScript compiles: `npm run build` — 695f48e
- [x] 1.2 Linting passes: `npm run lint` — 695f48e

#### Manual

- [x] 1.3 GET `/api/positions/` returns empty array for authenticated user — 695f48e
- [x] 1.4 POST `/api/positions/` with valid body returns 201 — 695f48e
- [x] 1.5 POST with invalid body returns 400 with field-level details — 695f48e
- [x] 1.6 GET/PUT/DELETE on `/api/positions/:id` work correctly — 695f48e
- [x] 1.7 Unauthenticated requests return 401 — 695f48e

### Phase 2: UI Components & Positions List

#### Automated

- [x] 2.1 Build passes: `npm run build` — 27bb79c
- [x] 2.2 Lint passes: `npm run lint` — 27bb79c

#### Manual

- [x] 2.3 Empty state with CTA renders at `/positions` — 27bb79c
- [x] 2.4 Positions display in card grid after creation — 27bb79c
- [x] 2.5 Delete confirmation dialog works and removes position — 27bb79c
- [x] 2.6 Topbar shows Positions link for authenticated users — 27bb79c
- [x] 2.7 Unauthenticated access redirects to sign-in — 27bb79c

### Phase 3: Position Create/Edit Form

#### Automated

- [x] 3.1 Build passes: `npm run build` — cfce21d
- [x] 3.2 Lint passes: `npm run lint` — cfce21d

#### Manual

- [x] 3.3 Create form renders with all fields at `/positions/new` — cfce21d
- [x] 3.4 Submit creates position and redirects to list — cfce21d
- [x] 3.5 Validation errors display on invalid input — cfce21d
- [x] 3.6 Edit form pre-fills with existing data — cfce21d
- [x] 3.7 Stale evaluation banner shows when evaluation exists — cfce21d
- [x] 3.8 Requirements editor: add, remove, expand for description — cfce21d

### Phase 4: Integration & Polish

#### Automated

- [x] 4.1 Build passes: `npm run build` — f6ae10d
- [x] 4.2 Lint passes: `npm run lint` — f6ae10d

#### Manual

- [x] 4.3 Sign-in redirects to `/positions` — f6ae10d
- [x] 4.4 `/` and `/dashboard` redirect to `/positions` for authenticated users — f6ae10d
- [x] 4.5 Loading skeleton shows while positions fetch — f6ae10d
- [x] 4.6 Position detail page displays all fields — f6ae10d
- [x] 4.7 Full CRUD flow works end-to-end seamlessly — f6ae10d
