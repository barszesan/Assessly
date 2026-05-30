import { describe, expect, it, vi } from "vitest";
import { runOpenAiSmokeTest } from "@/lib/ai/openai";
import type { AiProviderConfig } from "@/lib/ai/types";

const baseConfig: AiProviderConfig = {
  apiKey: "test-key",
  model: "gpt-4o-mini",
  timeoutMs: 1_000,
  maxOutputTokens: 80,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("runOpenAiSmokeTest", () => {
  it("parses valid schema-shaped output", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        output_text: JSON.stringify({ ok: true, message: "AI provider smoke test passed" }),
      }),
    );

    const result = await runOpenAiSmokeTest(baseConfig, fetcher);

    expect(result).toEqual({ ok: true, data: { ok: true, message: "AI provider smoke test passed" } });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects malformed JSON output", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ output_text: "not-json" }));

    const result = await runOpenAiSmokeTest(baseConfig, fetcher);

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_response" } });
  });

  it("rejects schema-invalid output", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        output_text: JSON.stringify({ ok: false, message: "wrong" }),
      }),
    );

    const result = await runOpenAiSmokeTest(baseConfig, fetcher);

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_response" } });
  });

  it("maps OpenAI HTTP failures", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ error: "quota" }, 429));

    const result = await runOpenAiSmokeTest(baseConfig, fetcher);

    expect(result).toEqual({
      ok: false,
      error: { code: "provider_error", message: "OpenAI provider returned HTTP 429", status: 429 },
    });
  });

  it("maps network failures", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await runOpenAiSmokeTest(baseConfig, fetcher);

    expect(result).toMatchObject({ ok: false, error: { code: "network_error" } });
  });

  it("passes conservative request limits to OpenAI", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        output_text: JSON.stringify({ ok: true, message: "ok" }),
      }),
    );

    await runOpenAiSmokeTest(baseConfig, fetcher);

    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({
      model: "gpt-4o-mini",
      max_output_tokens: 80,
    });
  });
});
