<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: CV Upload and Extraction

- **Plan**: context/changes/cv-upload-and-extraction/plan.md
- **Scope**: Phases 1-3 of 3
- **Date**: 2026-05-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 6 warnings 1 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Storage paths use raw client filenames

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/positions/[id]/candidates/upload.ts:78
- **Detail**: The upload route builds the storage key as `{user_id}/{position_id}/${file.name}` using the multipart filename directly. A crafted API request can send names containing `/`, `\`, `..`, control characters, or unusual Unicode. This stays under the user's RLS prefix, so it is not cross-user access, but it can create unexpected nested keys, make confirm/list matching unreliable, and leave orphaned files.
- **Fix**: Validate server-side filenames with a conservative shared rule before upload and confirm, e.g. basename only, PDF extension, no slashes/control characters, max 255 chars.
  - Strength: Preserves the current UX where filenames are displayed and used for duplicate checks.
  - Tradeoff: Some unusual but valid local filenames will be rejected.
  - Confidence: HIGH — both upload and confirm already key behavior by `file_name`, so a single shared validator fits the design.
  - Blind spot: Does not solve future duplicate/concurrency constraints by itself.
- **Decision**: FIXED — Added shared `candidateFileNameSchema` and enforced it in upload + confirm parsing.

### F2 — Batch upload can leave storage orphans on partial failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/positions/[id]/candidates/upload.ts:77
- **Detail**: The plan explicitly allowed partial upload failures without rollback, but this is still a data-safety risk. If file 1 uploads and file 2 fails, the route returns 500 and leaves file 1 in Storage without a candidate row. If confirm later fails, uploaded binaries can also remain orphaned.
- **Fix**: Track successfully uploaded paths during the loop and remove them before returning an upload error; consider cleanup on confirm failure for the just-submitted batch as a follow-up.
  - Strength: Narrow change that improves the current two-step flow without redesigning APIs.
  - Tradeoff: Cleanup itself can fail; the route needs best-effort error handling/logging.
  - Confidence: HIGH — uploaded paths are already collected in `uploads`.
  - Blind spot: Does not provide true DB+Storage atomicity.
- **Decision**: FIXED — Upload route now removes already-uploaded batch paths when a later upload fails.

### F3 — Candidate cap and filename uniqueness are race-prone

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/positions/[id]/candidates/confirm.ts:29
- **Detail**: The 10-candidate cap is enforced with `countCandidates` before insert. Concurrent confirms can both pass the count check and insert beyond 10. Similarly, duplicate filename prevention is mostly client-side/storage `upsert: false`, with no database uniqueness guarantee on `(position_id, file_name)`.
- **Fix A ⭐ Recommended**: Add a unique DB constraint on `(position_id, file_name)` and handle duplicate insert errors in the confirm API.
  - Strength: Fixes the duplicate-row class at the source with low API disruption.
  - Tradeoff: Does not fully enforce the max-10 cap under concurrency.
  - Confidence: HIGH — the data model already treats filename as unique per position throughout the UI.
  - Blind spot: Existing data is assumed duplicate-free.
- **Fix B**: Move confirm insertion into a Supabase RPC/transaction that locks the position/candidates set, checks count, enforces duplicates, and inserts as one unit.
  - Strength: Solves both cap and duplicate races comprehensively.
  - Tradeoff: More migration and service complexity than the current MVP.
  - Confidence: MED — exact locking approach should be validated against Supabase/Postgres RLS behavior.
  - Blind spot: Not tested under real concurrent requests.
- **Decision**: FIXED via Fix A — Added unique `(position_id, file_name)` constraint and duplicate insert error handling. Max-10 concurrency remains a known residual risk.

### F4 — Confirm schema accepts unbounded extracted text

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/schemas/candidate.ts:12
- **Detail**: `extracted_text` only requires `.min(1)`. A direct API caller can submit very large JSON payloads for up to 10 candidates and persist oversized text blobs.
- **Fix**: Add a practical `.max(...)` limit to `extracted_text` and mirror that limit in the client extraction/preview flow.
- **Decision**: FIXED — Added shared extracted-text max length, server schema max, client confirm guard, and textarea `maxLength`.

### F5 — PDF extraction runs all files and all pages without a cap

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/candidates/CvUploadFlow.tsx:79
- **Detail**: `CvUploadFlow` runs `Promise.allSettled(valid.map(...))`, and `extractTextFromPdf` loops through every page. Even with a 5 MB file cap, a batch of 10 complex PDFs can consume substantial CPU/memory and freeze the browser.
- **Fix**: Limit extraction concurrency and cap extracted pages or characters per file with a visible warning when text is truncated.
  - Strength: Keeps client-side extraction while reducing worst-case UI lockups.
  - Tradeoff: May omit some CV text from unusually long PDFs.
  - Confidence: MED — chosen caps need product judgment and real PDF samples.
  - Blind spot: Browser performance varies significantly by device.
- **Decision**: FIXED — Limited extraction concurrency to 2 files, capped PDF extraction pages/text, and marks truncated extractions as warnings.

### F6 — Upload route checks 50 MB only after multipart parsing

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/positions/[id]/candidates/upload.ts:27
- **Detail**: The plan required total batch body validation at 50 MB. The route calls `request.formData()` first, then sums parsed file sizes. That enforces file payload totals, but not an early request body cap before the runtime parses/buffers multipart input.
- **Fix**: Add a `Content-Length` preflight guard before `formData()` when the header is present, keeping the parsed file-size validation as a fallback.
- **Decision**: FIXED — Added `Content-Length` preflight guard before multipart parsing, with parsed file-size validation retained as fallback.

### F7 — pdfjs Vite/SSR config was added outside the phase file list

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: astro.config.mjs:15
- **Detail**: Phase 2 added `optimizeDeps.exclude` and `ssr.external` for `pdfjs-dist`. This was not listed in the original "Changes Required", but the inline comment says it prevents Vite from pulling pdfjs into the SSR graph and causing React invalid-hook-call errors. This looks justified and contained, not harmful scope creep.
- **Fix**: No code change required. If keeping strict plan hygiene, document the Vite/pdfjs workaround in the plan or review notes.
- **Decision**: FIXED — Documented as a justified Phase 2 bundling workaround in review/follow-up notes; no code change needed.

## Success Criteria Check

- `npx supabase db reset`: PASS
- `npm run lint`: PASS
- `npm run build`: PASS
- Manual Progress rows: all complete; Phase 3 manual verification confirmed by user on 2026-05-29.
