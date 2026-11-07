import { z } from "zod";

const username = z.string().trim().min(1).max(30);
const cursor = z
  .string()
  .min(1)
  .max(36)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
  .optional();

export const profileLookupSchema = z.object({ username }).strict();
export const connectionListSchema = z.object({
  kind: z.enum(["followers", "following"]),
  cursor,
}).strict();
export const requestListSchema = z.object({
  direction: z.enum(["received", "sent"]).default("received"),
  cursor,
}).strict();
export const blockedListSchema = z.object({ cursor }).strict();

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
