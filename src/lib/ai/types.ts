import type { AiSmokeResponse } from "@/lib/schemas/ai";

export interface AiProviderConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxOutputTokens: number;
}

export type AiSmokeResult = AiSmokeResponse;

export type AiProviderErrorCode =
  | "missing_config"
  | "network_error"
  | "provider_error"
  | "invalid_response"
  | "timeout";

export interface AiProviderError {
  code: AiProviderErrorCode;
  message: string;
  status?: number;
}

export type AiProviderResult<T> = { ok: true; data: T } | { ok: false; error: AiProviderError };
