# CV Upload and Extraction — Plan Brief

> Full plan: `context/changes/cv-upload-and-extraction/plan.md`

## What & Why

Recruiters need to upload CVs (PDF) to open positions and confirm text extraction before AI evaluation can run. This is the critical handoff between position creation (S-01, done) and AI evaluation (S-03, next). Without it, there's no candidate data for the AI to evaluate.

## Starting Point

- `candidates` table exists (from F-01) with `file_name`, `file_path`, `extracted_text` columns — but no application code uses it yet.
- `cvs` storage bucket exists (private, 5MB, PDF-only) — but has no RLS policies and no upload code.
- Position detail page has a disabled "Upload CVs (coming soon)" placeholder.
- All backend patterns (service layer, API routes, zod validation, React islands) are established from S-01.

## Desired End State

A recruiter on a position detail page can upload 1-20 PDFs, see extracted text previewed for each, optionally edit extractions, and confirm. Candidates then appear in a persistent list with delete capability. Storage is secured with per-user RLS. The upload flow is entirely client-side for extraction (no server CPU cost), making it compatible with Cloudflare Workers constraints.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|----------|--------|-------------------|--------|
| PDF extraction runtime | Client-side with pdf.js | Avoids Cloudflare Workers CPU limits; gives instant preview without server round-trip. | Plan |
| Upload flow UX | Batch upload → batch preview → confirm all | Fewest clicks, matches "submit a batch of CVs" mental model. | Plan |
| Storage RLS strategy | User-scoped paths (`{user_id}/{position_id}/{filename}`) | Simple ownership check matching existing RLS pattern — no joins needed. | Plan |
| Extraction editing | Read-only preview with optional edit toggle | Clean default; editing available when needed without cluttering the UI. | Plan |
| Failed extraction handling | Warn per-file, allow partial batch confirmation | Non-blocking — one bad file doesn't hold up the whole batch. | Plan |
| File management | Delete + re-add (no in-place replace) | Simple state management, clear mental model. | Plan |
| Candidate model | Additive uploads, max 20 per position | "Collect CVs over time" per PRD; 20 cap is generous for a small team. | Plan |
| Duplicate prevention | Block duplicate filenames per position (client-side) | Prevents confusion from identical entries without complex content hashing. | Plan |

## Scope

**In scope:**
- Storage RLS policies for `cvs` bucket
- Candidate service (CRUD) + API routes (upload, confirm, list, delete)
- Client-side PDF text extraction with pdf.js (dynamic import)
- Batch preview UI with edit toggle and remove/re-add
- Position detail page integration (candidate list + upload dialog)
- File validation (type, size, duplicates, count cap)

**Out of scope:**
- Server-side PDF extraction
- Non-PDF formats (DOCX, images)
- AI evaluation triggering (S-03)
- Candidate editing after confirmation
- OCR fallback for scanned PDFs
- Upload progress bars

## Architecture / Approach

Client-side extraction approach: user selects files → pdf.js (dynamically imported, ~500KB) extracts text in the browser → preview shown → on confirm, files upload to Supabase Storage via an API route, then a second API call creates candidate DB records with the confirmed extracted text. Two-step server interaction (upload files, then confirm with text) separates storage from data persistence, allowing the preview/edit step to happen entirely client-side.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|-----------------|----------|
| 1. Storage RLS & Candidate Service | Backend foundation — secure storage, CRUD API | Storage RLS policy syntax must be correct; tested via manual API calls |
| 2. PDF Upload & Extraction UI | Complete upload flow as React island | pdf.js bundling with Vite/Astro; SSR avoidance for browser-only lib |
| 3. Position Detail Integration | Wired into position page with candidate list | State synchronization between upload dialog and candidate list |

**Prerequisites:** S-01 (position management) complete, F-01 (database schema) complete, local Supabase running.
**Estimated effort:** ~2-3 sessions across 3 phases.

## Open Risks & Assumptions

- pdf.js extraction quality varies with PDF complexity — mitigated by the edit toggle, but scanned/image PDFs will always fail (no OCR in scope).
- `pdfjs-dist` Vite bundling may require configuration tweaks (worker path resolution). CDN worker URL is the fallback.
- Large batches (20 files × 5MB) may be slow to upload sequentially — acceptable for MVP but could warrant parallel upload in future.

## Success Criteria (Summary)

- Recruiter uploads 3 PDFs → sees extraction preview → confirms → candidates persist and appear in the position detail list.
- Storage RLS prevents cross-user file access.
- Full flow works within Cloudflare Workers constraints (no server-side PDF parsing).
