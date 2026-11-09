import { z } from "zod";

import { isReactionEmoji } from "./reactions";

export const MAX_IMAGE_BYTES = 10_000_000;

export const instantIdSchema = z
  .string()
  .min(1)
  .max(36)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const captionSchema = z
  .string()
  .trim()
  .max(60)
  .refine((value) => !/[\r\n]/.test(value), "Caption must be one line.");

export const feedCursorSchema = instantIdSchema;
export const localInstantIdSchema = z.string().uuid();

/** Whitelisted positive-reaction emojis only; anything else is rejected. */
export const reactionEmojiSchema = z
  .string()
  .max(16)
  .refine(isReactionEmoji, "Unsupported reaction.");
