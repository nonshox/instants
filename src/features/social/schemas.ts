import { z } from "zod";

const username = z.string().trim().min(1).max(30);

export const profileLookupSchema = z.object({ username }).strict();

export const relationshipInputSchema = z
  .object({
    username,
  })
  .strict();

export const requestDecisionSchema = z
  .object({
    username,
    action: z.enum(["approve", "reject"]),
  })
  .strict();

export type RequestDecision = z.infer<typeof requestDecisionSchema>;
