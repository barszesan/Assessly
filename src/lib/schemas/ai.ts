import { z } from "zod";

export const aiSmokeResponseSchema = z
  .object({
    ok: z.literal(true),
    message: z.string().trim().min(1, "Message is required"),
  })
  .strict();

export type AiSmokeResponse = z.infer<typeof aiSmokeResponseSchema>;
