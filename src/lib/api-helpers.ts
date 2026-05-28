import type { z } from "zod";

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(error: string, status: number, details?: Record<string, string[]>): Response {
  return new Response(JSON.stringify({ error, ...(details ? { details } : {}) }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { error: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: errorResponse("Invalid JSON body", 400) };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "_root";
      if (!(path in details)) details[path] = [];
      details[path].push(issue.message);
    }
    return { error: errorResponse("Validation failed", 400, details) };
  }

  return { data: result.data };
}

export function requireAuth(locals: App.Locals): { user: { id: string } } | { error: Response } {
  if (!locals.user) {
    return { error: errorResponse("Authentication required", 401) };
  }
  return { user: { id: locals.user.id } };
}
