<!-- PLAN-REVIEW-REPORT -->
# Plan Review: CV Upload and Extraction

- **Plan**: context/changes/cv-upload-and-extraction/plan.md
- **Mode**: Deep
- **Date**: 2026-05-29
- **Verdict**: REVISE → SOUND (after triage)
- **Findings**: 2 critical, 5 warnings, 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | WARNING |
| Blind Spots | FAIL |
| Plan Completeness | WARNING |

## Grounding

6/6 paths ✓, types ✓, supabase client ✓, brief↔plan ✓

## Findings

### F1 — Confirm endpoint trusts client-supplied file_path

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Confirm Candidates API Route
- **Detail**: Confirm accepts free-form `file_path` from the JSON body. A malicious/buggy client can submit any path, including one under another tenant's prefix, creating a DB row pointing at a file the user doesn't own. Storage RLS protects reads but not the dangling DB reference.
- **Fix A ⭐**: Server-derive file_path in confirm (`{auth.uid()}/{position_id}/{file_name}`); verify object exists via storage.list().
- **Fix B**: Validate client-supplied path prefix matches `{auth.uid()}/{position_id}/`.
- **Decision**: Fixed via Fix A — schema drops `file_path`; confirm route derives it and verifies object existence.

### F2 — 100MB upload routed through Cloudflare Workers

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes
- **Dimension**: Architectural Fitness
- **Location**: Phase 1 Upload API Route + Performance Considerations
- **Detail**: Server-proxied multipart of up to 100 MB (20×5MB) sits at Workers body-size limits, pays bandwidth twice, contradicts the plan's own "no server CPU cost" claim. Standard Supabase pattern is direct browser upload with the user's JWT, with RLS enforcing ownership.
- **Fix A ⭐**: Direct browser → Supabase Storage upload; drop the upload API route.
- **Fix B**: Keep server upload but one HTTP request per file.
- **Decision**: Fixed differently — keep server-proxied upload but **cap batch at 10 CVs (50 MB)** to stay under Workers limits. Cap applied throughout plan; F5 (count race) not closed (skipped).

### F3 — Zod schema forbids empty extracted_text

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Plan Completeness (internal contradiction)
- **Location**: Phase 1 §3 vs Phase 2 §4 warning state, plan-brief partial-batch claim
- **Detail**: `confirmCandidatesSchema` requires `extracted_text.min(1)`. Phase 2 defines a "warning" state for empty/short extractions; brief promises partial-batch confirmation. DB column is nullable. Warning-state items can't be confirmed under current schema.
- **Fix**: Allow nullable/empty extracted_text; let UI render the warning.
- **Decision**: SKIPPED — accept that warning-state items must be removed before confirm.

### F4 — Position-delete cascade leaves storage files orphaned

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Blind Spots
- **Location**: Phase 1 success criteria; existing `deletePosition`
- **Detail**: DB CASCADE removes candidate rows but not storage objects. The "deleting a position removes its candidates and storage files" verification will fail.
- **Fix A ⭐**: Modify `deletePosition` to list + remove storage files before DB delete; abort on storage error.
- **Fix B**: Drop the storage-cleanup claim and accept orphans for MVP.
- **Decision**: Fixed via Fix A — added Phase 1 §8 "Position Delete Storage Cleanup" with explicit contract (storage.list → remove → DB delete; abort on storage error).

### F5 — Concurrent uploads can exceed cap (TOCTOU)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Blind Spots
- **Location**: Phase 1 §4-5
- **Detail**: Non-transactional SELECT+INSERT for the count check. Two concurrent batches can both pass the check and exceed the cap.
- **Fix**: BEFORE INSERT trigger enforcing `count(*) WHERE position_id < 10`.
- **Decision**: SKIPPED — accept race for MVP.

### F6 — Candidate delete not atomic across DB + Storage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §2 / §6
- **Detail**: Plan doesn't specify order or failure handling; either order leaves an orphan in some failure modes.
- **Fix**: Specify order: storage.remove() first, then DB delete; on storage 404 proceed, else abort 500.
- **Decision**: Fixed in plan — Phase 1 §6 contract now spells out the order and failure handling.

### F7 — pdf.js worker from unpkg CDN adds external runtime dependency

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 §2
- **Detail**: Defaults to loading worker from unpkg — third-party uptime dep, CSP carve-out, version drift, slower first extraction. Vite supports bundling locally via `?url` import.
- **Fix**: Bundle worker locally via Vite URL import; unpkg only as fallback.
- **Decision**: Fixed in plan — Phase 2 §2 now specifies Vite URL import for the worker; unpkg called out as documented fallback only.

### F8 — Filename used verbatim in storage path (sanitization gap)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 1 §4 storage path
- **Detail**: `{user_id}/{position_id}/{filename}` uses raw user input; `/`, `..`, NULs, unicode tricks possible.
- **Fix**: UUID-named storage object; keep `file_name` in DB only for display.
- **Decision**: SKIPPED — F1 Fix A path-derivation assumes filenames are constrained; gap remains.

### F9 — Middleware step phrasing risks breaking API responses

- **Severity**: · OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §7
- **Detail**: Ambiguous wording could lead an implementer to add `/api/positions` to PROTECTED_ROUTES, turning JSON 401s into HTML redirects.
- **Fix**: Reword to "No change needed; do NOT add /api/positions to PROTECTED_ROUTES."
- **Decision**: SKIPPED.

### F10 — Filename collision in storage path

- **Severity**: · OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 1 §4 / Phase 2 §6
- **Detail**: Stale-tab races + Supabase upsert defaults can produce collisions on identical filenames; F8 (which would have closed this) was skipped.
- **Fix**: Pass `upsert: false`; surface collision error.
- **Decision**: SKIPPED.

### F11 — Sequential storage upload unspecified

- **Severity**: · OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Performance Considerations
- **Detail**: "Storage upload sequential" asserted but mechanism unspecified.
- **Fix**: Pin the contract — server iterates files in a `for...of` loop, fails fast on first error.
- **Decision**: Fixed in plan — Phase 1 §4 contract now includes the serialization rule.
