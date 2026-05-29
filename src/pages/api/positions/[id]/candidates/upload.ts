import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { errorResponse, jsonResponse, requireAuth, UUID_REGEX } from "@/lib/api-helpers";
import { getPosition } from "@/lib/services/positions";
import { countCandidates } from "@/lib/services/candidates";

export const prerender = false;

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TOTAL_CANDIDATES = 10;
const MAX_BATCH_BYTES = MAX_FILE_BYTES * MAX_TOTAL_CANDIDATES; // 50 MB

export const POST: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const positionId = context.params.id;
  if (!positionId || !UUID_REGEX.test(positionId)) return errorResponse("Invalid position ID", 400);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  // Verify position exists and belongs to the user (RLS enforces ownership).
  const position = await getPosition(supabase, positionId).catch(() => null);
  if (!position) return errorResponse("Position not found", 404);

  let formData: FormData;
  try {
    formData = await context.request.formData();
  } catch {
    return errorResponse("Invalid multipart body", 400);
  }

  const rawFiles = formData.getAll("files");
  const files: File[] = [];
  for (const entry of rawFiles) {
    if (entry instanceof File) files.push(entry);
  }

  if (files.length === 0) return errorResponse("No files provided", 400);
  if (files.length > MAX_TOTAL_CANDIDATES) {
    return errorResponse(`Maximum ${MAX_TOTAL_CANDIDATES} files per batch`, 400);
  }

  // Per-file validation
  let totalBytes = 0;
  for (const file of files) {
    if (file.type !== "application/pdf") {
      return errorResponse(`File "${file.name}" is not a PDF`, 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      return errorResponse(`File "${file.name}" exceeds 5MB limit`, 413);
    }
    totalBytes += file.size;
  }
  if (totalBytes > MAX_BATCH_BYTES) {
    return errorResponse("Batch exceeds 50MB total size limit", 413);
  }

  // Enforce per-position cap (existing + new ≤ 10)
  let existingCount = 0;
  try {
    existingCount = await countCandidates(supabase, positionId);
  } catch {
    return errorResponse("Failed to check existing candidates", 500);
  }
  if (existingCount + files.length > MAX_TOTAL_CANDIDATES) {
    return errorResponse(
      `Position already has ${existingCount} candidates. Adding ${files.length} would exceed the maximum of ${MAX_TOTAL_CANDIDATES}.`,
      400,
    );
  }

  const uploads: { file_name: string; file_path: string }[] = [];
  const folder = `${auth.user.id}/${positionId}`;

  for (const file of files) {
    const filePath = `${folder}/${file.name}`;
    const { error } = await supabase.storage.from("cvs").upload(filePath, file, {
      contentType: "application/pdf",
      upsert: false,
    });

    if (error) {
      return errorResponse(`Failed to upload "${file.name}": ${error.message}`, 500);
    }

    uploads.push({ file_name: file.name, file_path: filePath });
  }

  return jsonResponse({ uploads }, 201);
};
