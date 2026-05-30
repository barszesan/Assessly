import { describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
  OPENAI_API_KEY: "",
  OPENAI_MODEL: undefined,
}));

describe("runAiSmokeTest", () => {
  it("returns missing_config without calling the provider when OpenAI key is absent", async () => {
    const { runAiSmokeTest } = await import("@/lib/services/ai");
    const fetcher = vi.fn();

    const result = await runAiSmokeTest(fetcher);

    expect(result).toEqual({
      ok: false,
      error: { code: "missing_config", message: "AI provider config is missing" },
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
