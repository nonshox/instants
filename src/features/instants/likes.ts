import "server-only";
import { ID, Query, type Models } from "node-appwrite";
import { runTransaction } from "@/src/features/social/data";
import { canViewInstant } from "./policy";
import {
  getDatabaseId,
  getInstantRow,
  getTables,
  getUserPrivacy,
  type InstantRow,
} from "./data";
import { InstantNotFoundError } from "./service";
import {
  createNotificationInTransaction,
  dispatchTelegramNotification,
} from "@/src/features/notifications/service";

type LikeRow = Models.Row & {
  instant: string;
  user: string;
};

export type LikeResult = {
  liked: boolean;
  likes: number;
};

export async function setInstantLike(
  viewerId: string,
  instantId: string,
  liked: boolean,
): Promise<LikeResult> {
  const instant = await getInstantRow(instantId);
  if (!instant) {
    throw new InstantNotFoundError();
  }
  await assertCanLike(viewerId, instant);

  const existing = await findLike(viewerId, instantId);
  if (liked && !existing) {
    try {
      await runTransaction(async (transactionId) => {
        const tables = getTables();
        await tables.createRow<LikeRow>({
          databaseId: getDatabaseId(),
          tableId: "likes",
          rowId: ID.unique(),
          permissions: [],
          transactionId,
          data: { instant: instantId, user: viewerId },
        });
        await Promise.all([
          tables.incrementRowColumn({
            databaseId: getDatabaseId(),
            tableId: "instants",
            rowId: instantId,
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
            instantId,
          );
        }
      });
      if (instant.user !== viewerId) {
        await dispatchTelegramNotification(instant.user, viewerId, "like");
      }
    } catch (error) {
      const currentLike = await findLike(viewerId, instantId);
      if (!currentLike) {
        throw error;
      }
    }
  } else if (!liked && existing) {
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
            rowId: instantId,
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
    } catch (error) {
      const currentLike = await findLike(viewerId, instantId);
      if (currentLike) {
        throw error;
      }
    }
  }

  const [currentInstant, currentLike] = await Promise.all([
    getInstantRow(instantId),
    findLike(viewerId, instantId),
  ]);
  if (!currentInstant) {
    throw new InstantNotFoundError();
  }
  return { liked: Boolean(currentLike), likes: currentInstant.likes };
}

async function assertCanLike(viewerId: string, instant: InstantRow): Promise<void> {
  const owner = await getUserPrivacy(instant.user);
  if (!owner) {
    throw new InstantNotFoundError();
  }

  const isOwner = viewerId === instant.user;
  let isFollowing = false;
  let isBlocked = false;
  if (!isOwner) {
    const [follow, blockedByViewer, blockedViewer] = await Promise.all([
      getRelationship("follows", "follower", viewerId, "following", instant.user),
      getRelationship("blocks", "blocker", viewerId, "blocked", instant.user),
      getRelationship("blocks", "blocker", instant.user, "blocked", viewerId),
    ]);
    isFollowing = Boolean(follow);
    isBlocked = Boolean(blockedByViewer || blockedViewer);
  }

  if (!canViewInstant(owner.private, isOwner, isFollowing, isBlocked)) {
    throw new InstantNotFoundError();
  }
}

async function findLike(
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
    ],
    total: false,
  });
  return result.rows[0] ?? null;
}

async function getRelationship(
  tableId: "follows" | "blocks",
  firstKey: "follower" | "blocker",
  firstId: string,
  secondKey: "following" | "blocked",
  secondId: string,
): Promise<Models.Row | null> {
  const result = await getTables().listRows<Models.Row>({
    databaseId: getDatabaseId(),
    tableId,
    queries: [
      Query.equal(firstKey, firstId),
      Query.equal(secondKey, secondId),
      Query.limit(1),
    ],
    total: false,
  });
  return result.rows[0] ?? null;
}
