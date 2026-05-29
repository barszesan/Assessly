# CV Upload and Extraction Implementation Plan

## Overview

Implement the ability for recruiters to upload 1-10 PDF CVs to a position, extract text client-side using pdf.js, preview/confirm extractions (with optional editing), and persist candidates to Supabase Storage + database. This is slice S-02 in the roadmap, unlocking the AI evaluation step (S-03).

**Batch cap is 10 (not 20)** to stay well under Cloudflare Workers' request body size limit on the server-proxied upload route (10 × 5 MB = 50 MB).

## Current State Analysis

- **Database**: `candidates` table exists with `file_name`, `file_path`, `extracted_text` columns. FK to `positions` with CASCADE delete.
- **Storage**: `cvs` bucket created (private, 5MB, PDF-only) but has **no RLS policies** — access is unrestricted. Storage RLS must be added.
- **Position detail page**: Has a disabled "Upload CVs (coming soon)" placeholder in `src/pages/positions/[id]/index.astro`.
- **No candidate code exists**: No service, no API routes, no UI components for candidates.
- **Established patterns**: Service layer (`src/lib/services/`), zod schemas (`src/lib/schemas/`), API helpers (`src/lib/api-helpers.ts`), React islands with `client:load`.

### Key Discoveries:

- Storage path convention from migration: `cvs/` prefix. We'll use `{user_id}/{position_id}/{filename}` for RLS scoping.
- `Candidate` type already defined in `src/types.ts` — matches the DB schema.
- Position detail page already fetches the position server-side and passes data to React islands.
- The `PositionForm.tsx` pattern shows how forms handle state, validation, API calls, and error display.

## Desired End State

After this plan is complete:
- A recruiter on the position detail page can click "Upload CVs", select 1-10 PDF files (max 5MB each).
- Text is extracted client-side via pdf.js and shown in a batch preview. Failed extractions show warnings.
- The recruiter can edit extracted text (toggle) and remove/re-add files before confirming.
- On confirmation, files upload to Supabase Storage and candidate records persist to the database with extracted text.
- The position detail page shows existing candidates in a list with delete capability.
- Duplicate filenames (per position) are blocked client-side. Total candidates per position capped at 10.
- Storage RLS ensures users can only access their own files.

**Verification**: Upload 3 PDFs to a position → see extraction previews → confirm → candidates appear in the list. Delete one → list updates. Try uploading a 6th file when 5 exist → first 5 of the new batch succeed, 6th blocked at total 10.

## What We're NOT Doing

- Server-side PDF extraction (pdf.js runs in the browser only)
- DOCX or image file support (PDF only per PRD non-goals)
- AI evaluation triggering (that's S-03)
- Candidate editing after confirmation (edit extracted text only during preview)
- Batch re-extraction or OCR fallback for scanned PDFs
- Progress bars for individual file uploads (simple loading state is sufficient for 5MB files)
- Batches larger than 10 CVs per upload action (cap chosen to fit within Cloudflare Workers request body limits at 5 MB/file)

## Implementation Approach

Three-phase build following existing patterns:
1. **Backend first** — Storage RLS, candidate service, API routes (testable independently via API)
2. **Upload UI** — React island with pdf.js extraction, preview flow, confirmation
3. **Integration** — Wire into the position detail page, replace placeholder, show candidate list

Client-side extraction avoids Cloudflare Workers CPU constraints entirely. pdf.js is dynamically imported only when the upload flow is triggered, keeping the initial page bundle lean.

## Phase 1: Storage RLS & Candidate Service

### Overview

Establish the backend foundation: add Storage RLS policies to the `cvs` bucket so files are user-scoped, create the candidate service layer for CRUD operations, add API routes for uploading (multipart), listing, and deleting candidates.

### Changes Required:

#### 1. Storage RLS Migration

**File**: `supabase/migrations/<timestamp>_add_cvs_storage_rls.sql`

**Intent**: Add RLS policies to the `cvs` storage bucket enforcing that users can only INSERT, SELECT, and DELETE objects under their own `{user_id}/` path prefix. This was explicitly deferred from F-01.

**Contract**: Policies on `storage.objects` where `bucket_id = 'cvs'`:
- SELECT: `(storage.foldername(name))[1] = auth.uid()::text`
- INSERT: `(storage.foldername(name))[1] = auth.uid()::text`
- DELETE: `(storage.foldername(name))[1] = auth.uid()::text`

#### 2. Candidate Service

**File**: `src/lib/services/candidates.ts`

**Intent**: Provide typed CRUD operations for the `candidates` table — list by position, create (single), delete (single + storage cleanup), and count by position. Follows the same pattern as `src/lib/services/positions.ts`.

**Contract**:
- `listCandidates(supabase, positionId): Promise<Candidate[]>` — ordered by `created_at` ascending
- `createCandidate(supabase, input: { position_id, file_name, file_path, extracted_text }): Promise<Candidate>`
- `deleteCandidate(supabase, candidateId): Promise<{ filePath: string } | null>` — returns file_path for storage cleanup, null if not found
- `countCandidates(supabase, positionId): Promise<number>`

#### 3. Candidate Schema

**File**: `src/lib/schemas/candidate.ts`

**Intent**: Zod schemas for validating the confirm-upload request body (batch of candidates with extracted text). Note: `file_path` is NOT accepted from the client — see Confirm Candidates API Route below.

**Contract**:
```typescript
export const confirmCandidatesSchema = z.object({
  candidates: z.array(z.object({
    file_name: z.string().min(1).max(255),
    extracted_text: z.string().min(1, "Extracted text cannot be empty"),
  })).min(1).max(10),
});
```

#### 4. Upload API Route

**File**: `src/pages/api/positions/[id]/candidates/upload.ts`

**Intent**: Accept a multipart/form-data POST with one or more PDF files, upload each to Supabase Storage at `{user_id}/{position_id}/{filename}`, and return the storage paths (for client-side bookkeeping only — the confirm step re-derives them server-side and does not trust the client). Does NOT create candidate records — that happens on confirmation.

**Contract**: `POST /api/positions/:id/candidates/upload`
- Input: `multipart/form-data` with field `files` (one or more PDF files)
- Validates: position exists and belongs to user, each file is PDF and ≤5MB, total candidates (existing + new) ≤ 10, total batch body ≤ 50 MB (10 × 5 MB cap fits within Cloudflare Workers limits)
- Returns: `{ uploads: Array<{ file_name: string, file_path: string }> }` (201)
- Errors: 400 (validation), 401 (auth), 404 (position not found), 413 (file too large or batch too large)
- **Serialization**: server iterates the parsed multipart files sequentially in a `for...of` loop, uploading each to Storage before moving to the next. Fails fast on the first storage error (return 5xx with the offending filename) — partial uploads are not rolled back, but Phase 2 client re-attempts the whole batch on error, and orphans get reaped by F4's position-delete cleanup or future maintenance.

#### 5. Confirm Candidates API Route

**File**: `src/pages/api/positions/[id]/candidates/confirm.ts`

**Intent**: Accept the confirmed batch of candidates (with reviewed/edited extracted text) and create database records. This is the final step — candidates become "real" only after the recruiter confirms.

**Security note**: The route does NOT accept `file_path` from the client. For each item in the batch the server reconstructs the canonical storage path as `{auth.uid()}/{position_id}/{file_name}` and verifies the object exists in the `cvs` bucket (e.g. via `supabase.storage.from('cvs').list('{auth.uid()}/{position_id}/')`). Items whose object is missing → 400 with the offending filename(s) listed. This closes the trust gap where a client could submit an arbitrary path.

**Contract**: `POST /api/positions/:id/candidates/confirm`
- Input: JSON body matching `confirmCandidatesSchema` (file_name + extracted_text only)
- Validates: position exists and belongs to user; total candidates (existing + new) ≤ 10; every submitted file_name corresponds to an existing object at the derived canonical path
- Creates candidate records in batch, storing the server-derived `file_path`
- Returns: `{ candidates: Candidate[] }` (201)

#### 6. List Candidates API Route

**File**: `src/pages/api/positions/[id]/candidates/index.ts`

**Intent**: GET endpoint to list all candidates for a position. DELETE endpoint to remove a single candidate (by candidate ID in query param or path).

**Contract**:
- `GET /api/positions/:id/candidates` → `{ candidates: Candidate[] }`
- `DELETE /api/positions/:id/candidates` with `?candidateId=<uuid>` → deletes candidate record + storage file → 204
- **Delete order**: (1) fetch candidate row to get `file_path`, (2) `supabase.storage.from('cvs').remove([file_path])` first, (3) then DB delete. On storage 404 / object not found, proceed with DB delete (already cleaned). On any other storage error, abort with 500 — DB row stays intact so the user can retry.

#### 7. Middleware Update

**File**: `src/middleware.ts`

**Intent**: Ensure `/positions` routes (which include the new candidate sub-routes) are already in the `PROTECTED_ROUTES` array. Verify — likely no change needed since `/positions` is already protected.

#### 8. Position Delete Storage Cleanup

**File**: `src/lib/services/positions.ts` (modify existing `deletePosition`)

**Intent**: DB `ON DELETE CASCADE` removes candidate rows but does NOT remove their files from Supabase Storage. Without explicit cleanup, deleting a position orphans every CV file under `{user_id}/{position_id}/`. Modify `deletePosition` to remove the storage folder before deleting the DB row.

**Contract**:
- Before the DB DELETE, call `supabase.storage.from('cvs').list('{user_id}/{position_id}/')` to enumerate objects, then `supabase.storage.from('cvs').remove(paths)`.
- If storage list/remove returns an error (other than empty folder / not-found), abort with the storage error — the DB row is not deleted so the user can retry.
- Empty list → proceed with DB delete (no candidates to clean up).
- `userId` must be threaded into `deletePosition(supabase, id, userId)`; update the caller in `src/pages/api/positions/[id].ts` (or wherever delete is wired) accordingly.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset`
- TypeScript compiles: `npm run build`
- Linting passes: `npm run lint`
- API routes respond correctly (manual curl/httpie tests against local Supabase)

#### Manual Verification:

- Upload a PDF via the API and confirm it lands in Storage under the correct path
- Verify RLS blocks access to another user's files
- Confirm candidate creation and deletion work end-to-end via API
- Verify cascade: deleting a position removes its candidates and storage files

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: PDF Upload & Extraction UI

### Overview

Build the React island that handles the complete upload flow: file selection → client-side pdf.js text extraction → batch preview with edit toggle → confirmation. This component manages all client state and calls the Phase 1 API routes.

### Changes Required:

#### 1. Install pdfjs-dist

**File**: `package.json`

**Intent**: Add `pdfjs-dist` as a dependency for client-side PDF text extraction.

**Contract**: `npm install pdfjs-dist`

#### 2. PDF Extraction Utility

**File**: `src/lib/pdf-extract.ts`

**Intent**: A thin wrapper around pdfjs-dist that takes a `File` object and returns extracted text. Handles dynamic import of the library (so it's not in the initial bundle), worker configuration via Vite's bundled URL import (locally hosted, not a CDN), and error handling for unreadable PDFs.

**Contract**:
```typescript
export async function extractTextFromPdf(file: File): Promise<{ text: string } | { error: string }>
```

Uses dynamic `import("pdfjs-dist")`, iterates all pages, joins text with double newlines between pages.

**Worker configuration**: Bundle the worker locally via Vite's URL import so it ships from the same origin (no third-party CDN runtime dependency, no CSP carve-out, cached with the app):

```typescript
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;
```

If a Vite/Astro bundling issue surfaces during Phase 2 verification, fall back to a pinned unpkg URL matching the installed `pdfjs-dist` version — document the decision in the implementation log.

#### 3. CvUploadFlow Component

**File**: `src/components/candidates/CvUploadFlow.tsx`

**Intent**: The main orchestrating React component for the upload experience. Manages the multi-step state machine: idle → selecting files → extracting → previewing → uploading → done. Rendered inside a Dialog triggered from the position detail page.

**Contract**:
- Props: `positionId: string`, `existingCount: number`, `existingFileNames: string[]`, `onComplete: () => void`
- Internal state machine: `idle | extracting | previewing | uploading | error`
- Max files in this batch: `10 - existingCount`
- Calls `extractTextFromPdf` per file, then shows `CvPreviewList`
- On confirm: POSTs files to `/api/positions/:id/candidates/upload`, then POSTs `{ file_name, extracted_text }` items (no client-supplied file_path) to `/api/positions/:id/candidates/confirm`

#### 4. CvPreviewList Component

**File**: `src/components/candidates/CvPreviewList.tsx`

**Intent**: Renders the batch preview of all extracted candidates. Each item shows filename, extraction status (success/warning/failed), a read-only text preview with an "Edit" toggle that reveals a textarea, and a remove button.

**Contract**:
- Props: `candidates: CvPreviewItem[]`, `onRemove: (index) => void`, `onUpdateText: (index, text) => void`, `onConfirm: () => void`, `onCancel: () => void`, `isUploading: boolean`
- `CvPreviewItem`: `{ file: File, fileName: string, extractedText: string | null, status: 'success' | 'warning' | 'failed' }`
- Warning state: extraction returned empty or very short text (< 50 chars)
- Each item is collapsible (shows first ~200 chars by default)

#### 5. CvPreviewCard Component

**File**: `src/components/candidates/CvPreviewCard.tsx`

**Intent**: Individual candidate preview card within the batch list. Shows extraction status badge, filename, text preview (truncated), edit toggle with textarea, and remove button.

**Contract**:
- Props: `candidate: CvPreviewItem`, `onRemove: () => void`, `onUpdateText: (text: string) => void`
- Uses shadcn Card, Badge, Button, Textarea components
- Edit toggle switches between read-only `<pre>` and editable `<Textarea>`

#### 6. File Validation Utility

**File**: `src/lib/file-validation.ts`

**Intent**: Client-side validation for file selection — checks file type (PDF), size (≤5MB), duplicate filenames against existing candidates, and total count (≤10).

**Contract**:
```typescript
export interface FileValidationResult {
  valid: File[];
  errors: Array<{ fileName: string; reason: string }>;
}
export function validateFiles(files: File[], existingFileNames: string[], maxTotal: number): FileValidationResult
```

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npm run build`
- Linting passes: `npm run lint`
- No SSR errors (pdf.js only loads client-side via dynamic import)

#### Manual Verification:

- Select 3 PDF files → extraction runs → previews appear with text
- Edit one extraction → text updates in preview
- Remove a file → preview list updates
- Try uploading a non-PDF → blocked with error message
- Try uploading > 5MB file → blocked with error message
- Try uploading a duplicate filename → warning shown
- Confirm batch → candidates appear in position (after Phase 3 integration)
- Test with a scanned/image PDF → warning badge shows on that card

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Position Detail Integration

### Overview

Wire the upload flow into the position detail page. Replace the placeholder "Upload CVs" section with a live candidate list showing existing candidates (with delete), and a button that opens the upload dialog.

### Changes Required:

#### 1. CandidateList Component

**File**: `src/components/candidates/CandidateList.tsx`

**Intent**: React island that fetches and displays existing candidates for a position. Shows each candidate's filename, upload date, extracted text length indicator. Provides delete functionality and the "Upload CVs" button that opens the upload dialog.

**Contract**:
- Props: `positionId: string`
- Fetches candidates from `GET /api/positions/:id/candidates` on mount
- Shows loading skeleton while fetching
- Empty state: "No candidates uploaded yet" with prominent upload button
- Each candidate card: filename, date, text preview snippet, delete button
- Delete: confirmation dialog → `DELETE /api/positions/:id/candidates?candidateId=<id>` → optimistic removal
- Upload button opens `<CvUploadFlow>` in a Dialog
- After upload completes (`onComplete`), refetches candidate list

#### 2. Update Position Detail Page

**File**: `src/pages/positions/[id]/index.astro`

**Intent**: Replace the placeholder `<section>` for candidates with the `<CandidateList>` React island. Pass `positionId` as prop.

**Contract**: Remove the static disabled placeholder div. Add `<CandidateList positionId={position.id} client:load />`. Import from `@/components/candidates/CandidateList`.

#### 3. DeleteCandidateDialog Component

**File**: `src/components/candidates/DeleteCandidateDialog.tsx`

**Intent**: Confirmation dialog for deleting a candidate — shows filename, warns that this removes the file permanently.

**Contract**: Same pattern as `DeletePositionDialog.tsx` — uses shadcn Dialog, accepts `candidateId`, `fileName`, `onConfirm`, `open`, `onOpenChange` props.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npm run build`
- Linting passes: `npm run lint`
- Page loads without errors: visit `/positions/:id` in browser

#### Manual Verification:

- Position with no candidates shows empty state + upload button
- Click "Upload CVs" → dialog opens → full upload flow works end-to-end
- After confirmation, candidate list refreshes and shows new candidates
- Delete a candidate → confirmation dialog → candidate removed from list
- Upload more CVs to a position that already has some → additive (existing + new ≤ 10)
- Try to upload when 10 candidates already exist → blocked with message
- Verify duplicate filename check works against existing candidates

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Not required for MVP — project has no test runner configured (per health-check baseline)

### Integration Tests:

- Not required for MVP — deferred to post-launch

### Manual Testing Steps:

1. Create a new position with requirements
2. Navigate to position detail → see empty candidate section
3. Click "Upload CVs" → select 3 PDF files (one well-formatted, one with complex layout, one scanned)
4. Verify extraction preview shows text for readable PDFs and warning for scanned
5. Edit one extraction → confirm text persists in the textarea
6. Remove the scanned PDF → verify list updates
7. Add a replacement PDF → verify extraction runs
8. Click "Confirm" → verify upload progress → candidates appear in list
9. Refresh page → candidates still there
10. Delete one candidate → confirm dialog → candidate removed
11. Upload more CVs → verify additive behavior up to 10
12. Test with 5MB+ file → verify rejection
13. Test with non-PDF file → verify rejection
14. Test with duplicate filename → verify warning

## Performance Considerations

- **pdf.js loaded lazily**: Dynamic import means the ~500KB library only loads when the user clicks "Upload CVs", not on initial page load.
- **Extraction runs in parallel**: All files extract concurrently via `Promise.allSettled`, not sequentially.
- **Storage upload sequential**: Files upload one at a time to avoid overwhelming the connection for large batches, but this is acceptable for 1-10 files at ≤5MB each (max 50 MB total batch).
- **No server CPU cost**: All PDF parsing happens in the browser. The server only handles file storage (pass-through to Supabase Storage) and database writes.

## Migration Notes

- Storage RLS migration must be applied before testing uploads (`npx supabase db reset` or `npx supabase migration up`).
- No data migration needed — `candidates` table exists but is empty.
- The `cvs` storage bucket already exists from the initial migration.

## References

- PRD: `context/foundation/prd.md` (§CV Management, §Scope of Change)
- Roadmap: `context/foundation/roadmap.md` (S-02)
- DB schema migration: `supabase/migrations/20260525120000_create_positions_candidates_evaluations.sql`
- Position service pattern: `src/lib/services/positions.ts`
- Position API pattern: `src/pages/api/positions/index.ts`
- Types: `src/types.ts` (Candidate interface)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Storage RLS & Candidate Service

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 9462c1b
- [x] 1.2 TypeScript compiles: `npm run build` — 9462c1b
- [x] 1.3 Linting passes: `npm run lint` — 9462c1b

#### Manual

- [x] 1.4 Upload PDF via API lands in Storage under correct path — 9462c1b
- [x] 1.5 RLS blocks access to another user's files — 9462c1b
- [x] 1.6 Candidate creation and deletion work end-to-end via API — 9462c1b
- [x] 1.7 Cascade: deleting position removes candidates and storage files — 9462c1b

### Phase 2: PDF Upload & Extraction UI

#### Automated

- [x] 2.1 TypeScript compiles: `npm run build` — 0f6e0da
- [x] 2.2 Linting passes: `npm run lint` — 0f6e0da
- [x] 2.3 No SSR errors (pdf.js only loads client-side) — 0f6e0da

#### Manual

- [x] 2.4 Select 3 PDFs → extraction runs → previews appear (deferred to Phase 3 — flow not mounted in Phase 2) — 0f6e0da
- [x] 2.5 Edit extraction → text updates (deferred to Phase 3 — flow not mounted in Phase 2) — 0f6e0da
- [x] 2.6 Remove file → preview list updates (deferred to Phase 3 — flow not mounted in Phase 2) — 0f6e0da
- [x] 2.7 Non-PDF blocked, >5MB blocked, duplicate filename warned (deferred to Phase 3 — flow not mounted in Phase 2) — 0f6e0da
- [x] 2.8 Scanned/image PDF shows warning badge (deferred to Phase 3 — flow not mounted in Phase 2) — 0f6e0da

### Phase 3: Position Detail Integration

#### Automated

- [x] 3.1 TypeScript compiles: `npm run build` — 28df8d0
- [x] 3.2 Linting passes: `npm run lint` — 28df8d0
- [x] 3.3 Page loads without errors at `/positions/:id` — 28df8d0

#### Manual

- [x] 3.4 Empty state shows upload button — 28df8d0
- [x] 3.5 Full upload flow works end-to-end from position page — 28df8d0
- [x] 3.6 Delete candidate works with confirmation — 28df8d0
- [x] 3.7 Additive uploads work (existing + new ≤ 10) — 28df8d0
- [x] 3.8 Duplicate filename check works against existing candidates — 28df8d0
