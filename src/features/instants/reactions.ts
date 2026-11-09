/**
 * Viewer-chosen reaction emojis. One reaction per viewer per Instant, stored
 * on the `likes` row's `emoji` column. Only positive reactions are allowed.
 * Isomorphic — safe to import from client and server code.
 */
export const REACTION_EMOJIS = [
  "❤️",
  "🔥",
  "😍",
  "👏",
  "🙌",
  "🤩",
  "😄",
  "🎉",
  "💪",
  "🥹",
  "✨",
] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export const DEFAULT_REACTION: ReactionEmoji = "❤️";

export function isReactionEmoji(value: unknown): value is ReactionEmoji {
  return (
    typeof value === "string" &&
    (REACTION_EMOJIS as readonly string[]).includes(value)
  );
}

/** Any missing/invalid stored value is treated as a heart. */
export function normalizeReaction(value: unknown): ReactionEmoji {
  return isReactionEmoji(value) ? value : DEFAULT_REACTION;
}
