import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { createPositionSchema } from "@/lib/schemas/position";
import { listPositions, createPosition } from "@/lib/services/positions";
import { jsonResponse, errorResponse, parseJsonBody, requireAuth } from "@/lib/api-helpers";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  try {
    const positions = await listPositions(supabase);
    return jsonResponse(positions);
  } catch {
    return errorResponse("Failed to fetch positions", 500);
  }
};

export const POST: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  const parsed = await parseJsonBody(context.request, createPositionSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const position = await createPosition(supabase, parsed.data, auth.user.id);
    return jsonResponse(position, 201);
  } catch {
    return errorResponse("Failed to create position", 500);
  }
};
