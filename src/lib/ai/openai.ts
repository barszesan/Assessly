import { aiSmokeResponseSchema } from "@/lib/schemas/ai";
import type { AiProviderConfig, AiProviderErrorCode, AiProviderResult, AiSmokeResult } from "@/lib/ai/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const SMOKE_PROMPT =
  'Return exactly this JSON object and no markdown: {"ok": true, "message": "AI provider smoke test passed"}';

interface OpenAiResponseContent {
  type?: string;
  text?: string;
}

interface OpenAiResponseOutput {
  content?: OpenAiResponseContent[];
}

interface OpenAiResponseBody {
  output_text?: string;
  output?: OpenAiResponseOutput[];
}

type Fetcher = typeof fetch;

function providerError(code: AiProviderErrorCode, message: string, status?: number) {
  return { ok: false as const, error: { code, message, ...(status ? { status } : {}) } };
}

function extractOutputText(body: OpenAiResponseBody): string | null {
  if (typeof body.output_text === "string") return body.output_text;

  for (const output of body.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }

  return null;
}

export async function runOpenAiSmokeTest(
  config: AiProviderConfig,
  fetcher: Fetcher = fetch,
): Promise<AiProviderResult<AiSmokeResult>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, config.timeoutMs);

  try {
    const response = await fetcher(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        input: SMOKE_PROMPT,
        max_output_tokens: config.maxOutputTokens,
        text: {
          format: {
            type: "json_schema",
            name: "ai_smoke_response",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["ok", "message"],
              properties: {
                ok: { type: "boolean" },
                message: { type: "string", minLength: 1 },
              },
            },
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return providerError(
        "provider_error",
        `OpenAI provider returned HTTP ${response.status.toString()}`,
        response.status,
      );
    }

    const body = (await response.json()) as OpenAiResponseBody;
    const outputText = extractOutputText(body);
    if (!outputText) return providerError("invalid_response", "OpenAI response did not include output text");

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return providerError("invalid_response", "OpenAI response was not valid JSON");
    }

    const result = aiSmokeResponseSchema.safeParse(parsed);
    if (!result.success) return providerError("invalid_response", "OpenAI response did not match the smoke schema");

    return { ok: true, data: result.data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return providerError("timeout", "OpenAI smoke test timed out");
    }

    return providerError("network_error", "OpenAI smoke test request failed");
  } finally {
    clearTimeout(timeout);
  }
}
