import { OPENAI_API_KEY, OPENAI_MODEL } from "astro:env/server";
import { runOpenAiSmokeTest } from "@/lib/ai/openai";
import type { AiProviderResult, AiSmokeResult } from "@/lib/ai/types";

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const OPENAI_TIMEOUT_MS = 10_000;
const OPENAI_MAX_OUTPUT_TOKENS = 80;

export async function runAiSmokeTest(): Promise<AiProviderResult<AiSmokeResult>> {
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      error: {
        code: "missing_config",
        message: "AI provider config is missing",
      },
    };
  }

  return runOpenAiSmokeTest({
    apiKey: OPENAI_API_KEY,
    model: OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    timeoutMs: OPENAI_TIMEOUT_MS,
    maxOutputTokens: OPENAI_MAX_OUTPUT_TOKENS,
  });
}
