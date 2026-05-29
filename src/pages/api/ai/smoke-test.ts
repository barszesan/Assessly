import type { APIRoute } from "astro";
import { errorResponse, jsonResponse, requireAuth } from "@/lib/api-helpers";
import { runAiSmokeTest } from "@/lib/services/ai";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const auth = requireAuth(context.locals);
  if ("error" in auth) return auth.error;

  const result = await runAiSmokeTest();
  if (result.ok) return jsonResponse(result.data);

  if (result.error.code === "missing_config") return errorResponse(result.error.message, 503);
  if (result.error.code === "provider_error") return errorResponse(result.error.message, 502);

  return errorResponse(result.error.message, 500);
};
