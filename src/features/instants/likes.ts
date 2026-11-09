import "server-only";
import { after } from "next/server";
import { ID, Query, type Models } from "node-appwrite";
import { findLink, runTransaction } from "@/src/features/social/data";
import { canViewInstant } from "./policy";
import {
  getDatabaseId,
  getInstantRow,
  getTables,
  getUserPrivacy,
  type InstantRow,
} from "./data";
import { InstantNotFoundError } from "./service";
import { isReactionEmoji, normalizeReaction, DEFAULT_REACTION } from "./reactions";
import { recordViewIfAbsent } from "./views";
import {
  createNotificationInTransaction,
  dispatchTelegramNotification,
} from "@/src/features/notifications/service";

type LikeRow = Models.Row & {
  instant: string;
  user: string;
  emoji?: string | null;
};

export type ReactionResult = {
  /** The viewer's reaction after the operation, or null when removed. */
  reaction: string | null;
  /** Total reactions on the Instant (also the like counter). */
  reactions: number;
};

export class InvalidReactionError extends Error {
  constructor() {
    super("That reaction is not supported.");
    this.name = "InvalidReactionError";
  }
}

/**
 * Sets, switches, or clears the viewer's reaction on an Instant.
 *
 * Fast paths (no writes at all):
 *   - clearing a reaction that does not exist
 *   - re-applying the reaction the viewer already has
 * Switching emoji costs one row update and zero counter writes, because
 * `instants.likes` counts *reactions*, not emojis. Results are computed
 * locally; there is no trailing re-read on the happy path.
 */
export async function setInstantReaction(
  viewerId: string,
  instantId: string,
  emoji: string | null,
): Promise<ReactionResult> {
  if (emoji !== null && !isReactionEmoji(emoji)) {
    throw new InvalidReactionError();
  }

  const instant = await getInstantRow(instantId);
  if (!instant) {
    throw new InstantNotFoundError();
  }
  await assertCanReact(viewerId, instant);

  const existing = await findReaction(viewerId, instantId);
  const total = instant.likes;

  // No-ops: nothing to write.
  if (emoji === null && !existing) {
    return { reaction: null, reactions: total };
  }
  if (existing && emoji !== null && normalizeReaction(existing.emoji) === emoji) {
    return { reaction: emoji, reactions: total };
  }

  if (emoji === null) {
    return removeReaction(instant, existing!, viewerId);
  }
  if (!existing) {
    return addReaction(instant, viewerId, emoji);
  }
  return switchReaction(existing!, emoji, total);
}

async function addReaction(
  instant: InstantRow,
  viewerId: string,
  emoji: string,
): Promise<ReactionResult> {
  try {
    await runTransaction(async (transactionId) => {
      const tables = getTables();
      await tables.createRow<LikeRow>({
        databaseId: getDatabaseId(),
        tableId: "likes",
        rowId: ID.unique(),
        permissions: [],
        transactionId,
        data: { instant: instant.$id, user: viewerId, emoji },
      });
      await Promise.all([
        tables.incrementRowColumn({
          databaseId: getDatabaseId(),
          tableId: "instants",
          rowId: instant.$id,
          column: "likes",
          value: 1,
          transactionId,
        }),
        tables.incrementRowColumn({
          databaseId: getDatabaseId(),
          tableId: "users",
          rowId: instant.user,
          column: "likes",
          value: 1,
          transactionId,
        }),
      ]);
      if (instant.user !== viewerId) {
        await createNotificationInTransaction(
          instant.user,
          viewerId,
          "like",
          transactionId,
          instant.$id,
        );
      }
    });
    if (instant.user !== viewerId) {
      await dispatchTelegramNotification(instant.user, viewerId, "like");
    }
    // A fresh reaction counts as seeing the Instant — mark it handled.
    after(() => recordViewIfAbsent(viewerId, instant.$id));
    return { reaction: emoji, reactions: instant.likes + 1 };
  } catch (error) {
    // A concurrent request may have won the race: if our reaction now
    // exists, the other transaction did the work — treat as success.
    const current = await findReaction(viewerId, instant.$id);
    if (current) {
      return {
        reaction: normalizeReaction(current.emoji),
        reactions: (await getInstantRow(instant.$id))?.likes ?? instant.likes,
      };
    }
    throw error;
  }
}

async function removeReaction(
  instant: InstantRow,
  existing: LikeRow,
  viewerId: string,
): Promise<ReactionResult> {
  try {
    await runTransaction(async (transactionId) => {
      const tables = getTables();
      await tables.deleteRow({
        databaseId: getDatabaseId(),
        tableId: "likes",
        rowId: existing.$id,
        transactionId,
      });
      await Promise.all([
        tables.decrementRowColumn({
          databaseId: getDatabaseId(),
          tableId: "instants",
          rowId: instant.$id,
          column: "likes",
          value: 1,
          min: 0,
          transactionId,
        }),
        tables.decrementRowColumn({
          databaseId: getDatabaseId(),
          tableId: "users",
          rowId: instant.user,
          column: "likes",
          value: 1,
          min: 0,
          transactionId,
        }),
      ]);
    });
    return { reaction: null, reactions: Math.max(0, instant.likes - 1) };
  } catch (error) {
    const current = await findReaction(viewerId, instant.$id);
    if (current) {
      throw error;
    }
    // Already gone — treat the delete as idempotent success.
    return { reaction: null, reactions: Math.max(0, instant.likes - 1) };
  }
}

async function switchReaction(
  existing: LikeRow,
  emoji: string,
  total: number,
): Promise<ReactionResult> {
  await getTables().updateRow({
    databaseId: getDatabaseId(),
    tableId: "likes",
    rowId: existing.$id,
    data: { emoji },
  });
  // No counter changes — total reactions stay the same.
  return { reaction: emoji, reactions: total };
}

/** Kept for the legacy /like route: ❤️ alias of the typed API. */
export async function setInstantLike(
  viewerId: string,
  instantId: string,
  liked: boolean,
): Promise<{ liked: boolean; likes: number }> {
  const result = await setInstantReaction(
    viewerId,
    instantId,
    liked ? DEFAULT_REACTION : null,
  );
  return { liked: result.reaction !== null, likes: result.reactions };
}

async function assertCanReact(
  viewerId: string,
  instant: InstantRow,
): Promise<void> {
  const owner = await getUserPrivacy(instant.user);
  if (!owner) {
    throw new InstantNotFoundError();
  }

  const isOwner = viewerId === instant.user;
  let isLinked = false;
  let isBlocked = false;
  if (!isOwner) {
    const [link, blockedByViewer, blockedViewer] = await Promise.all([
      findLink(viewerId, instant.user),
      findBlock(viewerId, instant.user),
      findBlock(instant.user, viewerId),
    ]);
    isLinked = Boolean(link);
    isBlocked = Boolean(blockedByViewer || blockedViewer);
  }

  if (!canViewInstant(owner.private, isOwner, isLinked, isBlocked)) {
    throw new InstantNotFoundError();
  }
}

async function findReaction(
  userId: string,
  instantId: string,
): Promise<LikeRow | null> {
  const result = await getTables().listRows<LikeRow>({
    databaseId: getDatabaseId(),
    tableId: "likes",
    queries: [
      Query.equal("instant", instantId),
      Query.equal("user", userId),
      Query.limit(1),
      Query.select(["instant", "user", "emoji"]),
    ],
    total: false,
  });
  return result.rows[0] ?? null;
}

async function findBlock(
  blockerId: string,
  blockedId: string,
): Promise<Models.Row | null> {
  const result = await getTables().listRows<Models.Row>({
    databaseId: getDatabaseId(),
    tableId: "blocks",
    queries: [
      Query.equal("blocker", blockerId),
      Query.equal("blocked", blockedId),
      Query.limit(1),
    ],
    total: false,
  });
  return result.rows[0] ?? null;
}
