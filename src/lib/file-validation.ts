/**
 * Client-side file validation for CV uploads.
 * Mirrors the server-side checks in the upload route — fails fast in the UI
 * before any network round-trip or pdf.js work.
 */

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_MIME_TYPE = "application/pdf";
export const ACCEPTED_EXTENSION = ".pdf";

export interface FileValidationResult {
  valid: File[];
  errors: { fileName: string; reason: string }[];
}

function isPdf(file: File): boolean {
  if (file.type === ACCEPTED_MIME_TYPE) return true;
  // Some browsers (or drag-drop sources) leave file.type empty — fall back to
  // the extension check so a legitimate PDF isn't rejected on a missing MIME.
  return file.name.toLowerCase().endsWith(ACCEPTED_EXTENSION);
}

export function validateFiles(files: File[], existingFileNames: string[], maxTotal: number): FileValidationResult {
  const valid: File[] = [];
  const errors: { fileName: string; reason: string }[] = [];

  const existingSet = new Set(existingFileNames);
  const seenInBatch = new Set<string>();

  for (const file of files) {
    if (!isPdf(file)) {
      errors.push({ fileName: file.name, reason: "Only PDF files are allowed" });
      continue;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push({ fileName: file.name, reason: "File exceeds 5 MB limit" });
      continue;
    }
    if (existingSet.has(file.name)) {
      errors.push({ fileName: file.name, reason: "A candidate with this filename already exists" });
      continue;
    }
    if (seenInBatch.has(file.name)) {
      errors.push({ fileName: file.name, reason: "Duplicate filename in this batch" });
      continue;
    }
    if (valid.length >= maxTotal) {
      errors.push({
        fileName: file.name,
        reason: `Batch cap reached (max ${maxTotal.toString()} more in this position)`,
      });
      continue;
    }
    seenInBatch.add(file.name);
    valid.push(file);
  }

  return { valid, errors };
}
