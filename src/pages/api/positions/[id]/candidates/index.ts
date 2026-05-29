import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { errorResponse, jsonResponse, requireAuth, UUID_REGEX } from "@/lib/api-helpers";
import { getPosition } from "@/lib/services/positions";
import { deleteCandidate, listCandidates } from "@/lib/services/candidates";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const positionId = context.params.id;
  if (!positionId || !UUID_REGEX.test(positionId)) return errorResponse("Invalid position ID", 400);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  const position = await getPosition(supabase, positionId).catch(() => null);
  if (!position) return errorResponse("Position not found", 404);

  try {
    const candidates = await listCandidates(supabase, positionId);
    return jsonResponse({ candidates });
  } catch {
    return errorResponse("Failed to list candidates", 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const positionId = context.params.id;
  if (!positionId || !UUID_REGEX.test(positionId)) return errorResponse("Invalid position ID", 400);

  const candidateId = new URL(context.request.url).searchParams.get("candidateId");
  if (!candidateId || !UUID_REGEX.test(candidateId)) return errorResponse("Invalid candidate ID", 400);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  const position = await getPosition(supabase, positionId).catch(() => null);
  if (!position) return errorResponse("Position not found", 404);

  // Fetch row first so we have file_path; then remove storage object, then DB row.
  // On storage 404 / object-not-found, proceed with DB delete (treat as already cleaned).
  // On other storage error, abort with 500 and leave DB row intact so the user can retry.
  const { data: existing, error: fetchError } = await supabase
    .from("candidates")
    .select("id, file_path, position_id")
    .eq("id", candidateId)
    .eq("position_id", positionId)
    .maybeSingle();

  if (fetchError) return errorResponse("Failed to fetch candidate", 500);
  if (!existing) return errorResponse("Candidate not found", 404);

  const filePath = (existing as { file_path: string }).file_path;

  const { error: removeError } = await supabase.storage.from("cvs").remove([filePath]);
  if (removeError) {
    const msg = removeError.message.toLowerCase();
    const isNotFound = msg.includes("not found") || msg.includes("no such") || msg.includes("does not exist");
    if (!isNotFound) {
      return errorResponse(`Failed to remove storage object: ${removeError.message}`, 500);
    }
  }

  try {
    const deleted = await deleteCandidate(supabase, candidateId);
    if (!deleted) return errorResponse("Candidate not found", 404);
  } catch {
    return errorResponse("Failed to delete candidate", 500);
  }

  return new Response(null, { status: 204 });
};
