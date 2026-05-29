import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { errorResponse, jsonResponse, parseJsonBody, requireAuth, UUID_REGEX } from "@/lib/api-helpers";
import { getPosition } from "@/lib/services/positions";
import { confirmCandidatesSchema } from "@/lib/schemas/candidate";
import { countCandidates, createCandidatesBatch } from "@/lib/services/candidates";

export const prerender = false;

const MAX_TOTAL_CANDIDATES = 10;

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

export const POST: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const positionId = context.params.id;
  if (!positionId || !UUID_REGEX.test(positionId)) return errorResponse("Invalid position ID", 400);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  const parsed = await parseJsonBody(context.request, confirmCandidatesSchema);
  if ("error" in parsed) return parsed.error;

  // Verify position exists and belongs to the user
  const position = await getPosition(supabase, positionId).catch(() => null);
  if (!position) return errorResponse("Position not found", 404);

  // Enforce per-position cap (existing + new ≤ 10)
  let existingCount = 0;
  try {
    existingCount = await countCandidates(supabase, positionId);
  } catch {
    return errorResponse("Failed to check existing candidates", 500);
  }
  if (existingCount + parsed.data.candidates.length > MAX_TOTAL_CANDIDATES) {
    return errorResponse(
      `Position already has ${existingCount} candidates. Adding ${parsed.data.candidates.length} would exceed the maximum of ${MAX_TOTAL_CANDIDATES}.`,
      400,
    );
  }

  // Verify every submitted file_name has a corresponding object in storage
  // at the canonical path {auth.uid()}/{position_id}/{file_name}.
  const folder = `${auth.user.id}/${positionId}`;
  const { data: objects, error: listError } = await supabase.storage.from("cvs").list(folder);
  if (listError) {
    return errorResponse(`Failed to verify uploaded files: ${listError.message}`, 500);
  }

  const objectNames = new Set(objects.map((o: { name: string }) => o.name));
  const missing = parsed.data.candidates.filter((c) => !objectNames.has(c.file_name)).map((c) => c.file_name);

  if (missing.length > 0) {
    return errorResponse(`Missing uploaded files for: ${missing.join(", ")}`, 400);
  }

  // Build canonical inputs (server-derived file_path; client cannot influence it)
  const inputs = parsed.data.candidates.map((c) => ({
    position_id: positionId,
    file_name: c.file_name,
    file_path: `${folder}/${c.file_name}`,
    extracted_text: c.extracted_text,
  }));

  try {
    const candidates = await createCandidatesBatch(supabase, inputs);
    return jsonResponse({ candidates }, 201);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return errorResponse("A candidate with this filename already exists", 400);
    }
    return errorResponse("Failed to create candidates", 500);
  }
};
