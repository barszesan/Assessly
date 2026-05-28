import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { positionHasEvaluation } from "@/lib/services/positions";
import { jsonResponse, errorResponse, requireAuth } from "@/lib/api-helpers";

export const prerender = false;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const id = context.params.id;
  if (!id || !UUID_REGEX.test(id)) return errorResponse("Invalid position ID", 400);

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) return errorResponse("Service unavailable", 503);

  try {
    const hasEvaluation = await positionHasEvaluation(supabase, id);
    return jsonResponse({ hasEvaluation });
  } catch {
    return errorResponse("Failed to check evaluation status", 500);
  }
};
