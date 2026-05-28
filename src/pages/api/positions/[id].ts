import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updatePositionSchema } from "@/lib/schemas/position";
import { getPosition, updatePosition, deletePosition } from "@/lib/services/positions";
import { jsonResponse, errorResponse, parseJsonBody, requireAuth, UUID_REGEX } from "@/lib/api-helpers";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) return errorResponse("Invalid position ID", 400);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  try {
    const position = await getPosition(supabase, id);
    if (!position) return errorResponse("Position not found", 404);
    return jsonResponse(position);
  } catch {
    return errorResponse("Failed to fetch position", 500);
  }
};

export const PUT: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) return errorResponse("Invalid position ID", 400);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  const parsed = await parseJsonBody(context.request, updatePositionSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const position = await updatePosition(supabase, id, parsed.data);
    if (!position) return errorResponse("Position not found", 404);
    return jsonResponse(position);
  } catch {
    return errorResponse("Failed to update position", 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) return errorResponse("Invalid position ID", 400);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  try {
    const deleted = await deletePosition(supabase, id);
    if (!deleted) return errorResponse("Position not found", 404);
    return new Response(null, { status: 204 });
  } catch {
    return errorResponse("Failed to delete position", 500);
  }
};
