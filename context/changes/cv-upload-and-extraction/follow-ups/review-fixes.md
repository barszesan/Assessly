# Review Fixes

Source: `context/changes/cv-upload-and-extraction/reviews/impl-review.md`

Decisions and follow-up implementation notes from implementation review triage.

## F1 — Storage paths use raw client filenames

- **Decision**: Fixed now.
- **Change**: Added shared `candidateFileNameSchema` and enforced it in upload + confirm parsing.
- **Verification**: `npm run lint` PASS; `npm run build` PASS.

## F2 — Batch upload can leave storage orphans on partial failure

- **Decision**: Fixed now.
- **Change**: Upload route removes already-uploaded batch paths when a later upload fails.
- **Verification**: `npm run lint` PASS; `npm run build` PASS.

## F3 — Candidate cap and filename uniqueness are race-prone

- **Decision**: Fixed via Fix A.
- **Change**: Added unique `(position_id, file_name)` constraint and duplicate insert error handling. Max-10 concurrency remains a known residual risk.
- **Verification**: `npm run lint` PASS; `npm run build` PASS; `npx supabase db reset` PASS.

## F4 — Confirm schema accepts unbounded extracted text

- **Decision**: Fixed now.
- **Change**: Added shared extracted-text max length, server schema max, client confirm guard, and textarea `maxLength`.
- **Verification**: `npm run lint` PASS; `npm run build` PASS.

## F5 — PDF extraction runs all files and all pages without a cap

- **Decision**: Fixed now.
- **Change**: Limited extraction concurrency to 2 files, capped PDF extraction pages/text, and marks truncated extractions as warnings.
- **Verification**: `npm run lint` PASS; `npm run build` PASS.

## F6 — Upload route checks 50 MB only after multipart parsing

- **Decision**: Fixed now.
- **Change**: Added `Content-Length` preflight guard before multipart parsing, with parsed file-size validation retained as fallback.
- **Verification**: `npm run lint` PASS; `npm run build` PASS.

## F7 — pdfjs Vite/SSR config was added outside the phase file list

- **Decision**: Fixed now.
- **Change**: Documented as a justified Phase 2 bundling workaround in review/follow-up notes; no code change needed.
