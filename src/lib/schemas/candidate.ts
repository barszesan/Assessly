import { z } from "zod";

export const MAX_EXTRACTED_TEXT_CHARS = 100_000;

export const candidateFileNameSchema = z
  .string()
  .min(1, "File name is required")
  .max(255, "File name must be 255 characters or less")
  .refine((name) => name === name.trim(), "File name cannot start or end with whitespace")
  .refine((name) => !name.includes("/") && !name.includes("\\"), "File name contains unsupported characters")
  .refine(
    (name) => !Array.from(name).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    "File name contains unsupported characters",
  )
  .refine((name) => !name.includes(".."), "File name cannot contain path traversal segments")
  .refine((name) => name.toLowerCase().endsWith(".pdf"), "File name must end with .pdf");

export const confirmCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        file_name: candidateFileNameSchema,
        extracted_text: z
          .string()
          .min(1, "Extracted text cannot be empty")
          .max(
            MAX_EXTRACTED_TEXT_CHARS,
            `Extracted text must be ${MAX_EXTRACTED_TEXT_CHARS.toString()} characters or less`,
          ),
      }),
    )
    .min(1, "At least one candidate is required")
    .max(10, "Maximum 10 candidates per batch"),
});

export type ConfirmCandidatesInput = z.infer<typeof confirmCandidatesSchema>;
