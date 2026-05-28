import { z } from "zod";

const requirementSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Requirement name is required")
    .max(100, "Requirement name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
});

export const createPositionSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().max(2000, "Description must be 2000 characters or less").optional(),
  seniority: z.enum(["junior", "mid", "senior"], {
    errorMap: () => ({ message: "Invalid seniority level" }),
  }),
  team: z.string().trim().max(200, "Team must be 200 characters or less").optional(),
  requirements: z
    .array(requirementSchema)
    .min(1, "At least one requirement is needed")
    .max(20, "Maximum 20 requirements allowed"),
});

export const updatePositionSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or less").optional(),
    description: z.string().max(2000, "Description must be 2000 characters or less").nullable().optional(),
    seniority: z
      .enum(["junior", "mid", "senior", "lead", "principal"], {
        errorMap: () => ({ message: "Invalid seniority level" }),
      })
      .optional(),
    team: z.string().trim().max(200, "Team must be 200 characters or less").nullable().optional(),
    requirements: z
      .array(requirementSchema)
      .min(1, "At least one requirement is needed")
      .max(20, "Maximum 20 requirements allowed")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export type CreatePositionInput = z.infer<typeof createPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
