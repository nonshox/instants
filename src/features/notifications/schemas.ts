import { z } from "zod";

export const notificationIdSchema = z
  .string()
  .min(1)
  .max(36)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const notificationCursorSchema = notificationIdSchema;

export const readNotificationsSchema = z
  .object({
    ids: z.array(notificationIdSchema).min(1).max(50),
  })
  .strict()
  .refine((value) => new Set(value.ids).size === value.ids.length);
