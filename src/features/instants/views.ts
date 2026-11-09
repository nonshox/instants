import "server-only";
import { AppwriteException, ID, Query, type Models } from "node-appwrite";
import { findLink } from "@/src/features/social/data";
import {
  getDatabaseId,
  getInstantRow,
  getTables,
  getUserPrivacy,
} from "./data";
import { canViewInstant } from "./policy";
import { normalizeReaction } from "./reactions";
import { InstantNotFoundError } from "./service";

type ViewRow = Models.Row & {
  instant: string;
  user: string;
  seen: string;
};

export type InstantViewer = {
  userId: string;
  username: string;
  avatar: string;
  seenAt: string;
  reaction: string | null;
};

/**
 * Records that `viewerId` has dealt or reacted to an Instant.
 * Idempotent — the first sighting is kept, repeats are a no-op.
 */
export async function recordView(
  viewerId: string,
  instantId: string,
): Promise<{ seen: true }> {
  const instant = await getInstantRow(instantId);
  if (!instant) {
    throw new InstantNotFoundError();
  }
  await assertCanView(viewerId, instant.user, viewerId === instant.user);

  try {
    await getTables().createRow<ViewRow>({
      databaseId: getDatabaseId(),
      tableId: "views",
      rowId: ID.unique(),
      permissions: [],
      data: {
        instant: instantId,
        user: viewerId,
        seen: new Date().toISOString(),
      },
    });
  } catch (error) {
    // Unique index instant_user_uq — already seen is a success, not a failure.
    if (!(error instanceof AppwriteException && error.code === 409)) {
      throw error;
    }
  }
  return { seen: true };
}

/** Best-effort insert used by reaction side effects. Never throws. */
export async function recordViewIfAbsent(
  viewerId: string,
  instantId: string,
): Promise<void> {
  try {
    await recordView(viewerId, instantId);
  } catch {
    // A missed view marker is harmless — the deck re-presents at worst.
  }
}

/** Owner-facing seen-by list for one of their own Instants. */
export async function listViewersOfInstant(
  instantId: string,
  requesterId: string,
): Promise<InstantViewer[]> {
  const instant = await getInstantRow(instantId);
  if (!instant) {
    throw new InstantNotFoundError();
  }
  // Only the owner may see who viewed — hide existence otherwise.
  if (instant.user !== requesterId) {
    throw new InstantNotFoundError();
  }

  const [result, reactions] = await Promise.all([
    getTables().listRows<ViewRow>({
      databaseId: getDatabaseId(),
      tableId: "views",
      queries: [
        Query.equal("instant", instantId),
        Query.orderDesc("seen"),
        Query.limit(100),
        Query.select(["user", "seen"]),
      ],
      total: false,
    }),
    getTables().listRows<
      Models.Row & { user: string; emoji?: string | null }
    >({
      databaseId: getDatabaseId(),
      tableId: "likes",
      queries: [
        Query.equal("instant", instantId),
        Query.limit(5000),
        Query.select(["user", "emoji"]),
      ],
      total: false,
    }),
  ]);
  const reactionByUser = new Map(
    reactions.rows.map((row) => [row.user, normalizeReaction(row.emoji)]),
  );
  if (result.rows.length === 0) {
    return [];
  }

  const profiles = await getTables().listRows<
    Models.Row & { username: string; avatar: string }
  >({
    databaseId: getDatabaseId(),
    tableId: "users",
    queries: [
      Query.equal(
        "$id",
        result.rows.map((row) => row.user),
      ),
      Query.limit(100),
      Query.select(["$id", "username", "avatar"]),
    ],
    total: false,
  });
  const profileById = new Map(
    profiles.rows.map((row) => [row.$id, row]),
  );

  return result.rows.map((row) => ({
    userId: row.user,
    username: profileById.get(row.user)?.username ?? "unknown",
    avatar: profileById.get(row.user)?.avatar ?? "",
    seenAt: row.seen,
    reaction: reactionByUser.get(row.user) ?? null,
  }));
}

async function assertCanView(
  viewerId: string,
  ownerId: string,
  isOwner: boolean,
): Promise<void> {
  const owner = await getUserPrivacy(ownerId);
  if (!owner) {
    throw new InstantNotFoundError();
  }

  let isLinked = false;
  let isBlocked = false;
  if (!isOwner) {
    const [link, blockedByViewer, blockedViewer] = await Promise.all([
      findLink(viewerId, ownerId),
      findBlock(viewerId, ownerId),
      findBlock(ownerId, viewerId),
    ]);
    isLinked = Boolean(link);
    isBlocked = Boolean(blockedByViewer || blockedViewer);
  }

  if (!canViewInstant(owner.private, isOwner, isLinked, isBlocked)) {
    throw new InstantNotFoundError();
  }
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
