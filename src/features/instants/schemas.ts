import { z } from "zod";

export const MAX_IMAGE_BYTES = 10_000_000;

export const instantIdSchema = z
  .string()
  .min(1)
  .max(36)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const captionSchema = z
  .string()
  .trim()
  .max(100)
  .refine((value) => !/[\r\n]/.test(value), "Caption must be one line.")
  .refine(
    (value) => value === "" || value.split(/\s+/).length <= 5,
    "Caption must be five words or fewer.",
  );

export const feedCursorSchema = instantIdSchema;
export const localInstantIdSchema = z.string().uuid();
