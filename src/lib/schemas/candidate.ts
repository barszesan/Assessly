import { z } from "zod";

export const confirmCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        file_name: z
          .string()
          .trim()
          .min(1, "File name is required")
          .max(255, "File name must be 255 characters or less"),
        extracted_text: z.string().min(1, "Extracted text cannot be empty"),
      }),
    )
    .min(1, "At least one candidate is required")
    .max(10, "Maximum 10 candidates per batch"),
});

export type ConfirmCandidatesInput = z.infer<typeof confirmCandidatesSchema>;
