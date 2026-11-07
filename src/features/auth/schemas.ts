import { z } from "zod";

const userIdSchema = z
  .string()
  .min(1)
  .max(36)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const emailTokenRequestSchema = z
  .object({
    email: z.string().trim().pipe(z.email().max(254)),
  })
  .strict();

export const emailTokenVerifySchema = z
  .object({
    userId: userIdSchema,
    secret: z.string().regex(/^\d{6}$/),
  })
  .strict();

export const revokeSessionSchema = z
  .object({
    sessionId: userIdSchema,
  })
  .strict();

export const profileInputSchema = z
  .object({
    username: z.string().trim().min(1).max(30),
    name: z.string().trim().max(50),
    bio: z.string().trim(),
    private: z.boolean(),
  })
  .strict();
