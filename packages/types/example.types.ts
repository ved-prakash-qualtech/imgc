import { z } from "zod";

/** Example resource — replace with real product types. */
export interface Example {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PENDING";
  createdAt: string;
}

/** Zod schema = the validation source of truth (forms AND BFF input). */
export const createExampleSchema = z.object({
  name: z.string().min(1, "name must not be blank").max(255),
  description: z.string().max(2000).optional(),
});

export type CreateExampleInput = z.infer<typeof createExampleSchema>;
