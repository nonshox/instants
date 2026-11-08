import "server-only";
import { AppwriteException, ID, Query, type Models } from "node-appwrite";
import { after } from "next/server";
import { getDatabaseId, getTables } from "@/src/features/instants/data";
import { runTransaction } from "@/src/features/social/data";
import { sendTelegramNotification } from "@/src/features/telegram/service";
import {
  getBlockedUserIds,
  getNotificationActors,
  getNotificationRows,
  markNotificationsRead,
} from "./data";
import type {
  NotificationItem,
  NotificationRow,
  NotificationType,
} from "./types";

export async function createNotificationInTransaction(
  recipient: string,
  actor: string,
  type: NotificationType,
  transactionId: string,
  instant?: string,
): Promise<void> {
  await getTables().createRow<NotificationRow>({
    databaseId: getDatabaseId(),
    tableId: "notifications",
    rowId: ID.unique(),
    permissions: [],
    transactionId,
    data: {
      recipient,
      actor,
      type,
      ...(instant ? { instant } : {}),
      read: false,
    },
  });
}

export async function listNotifications(
  userId: string,
  cursor: string | null,
): Promise<{
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
}> {
  const [rows, blocked] = await Promise.all([
    getNotificationRows(userId, cursor),
    getBlockedUserIds(userId),
  ]);
  const unreadCount = await getUnreadCount(userId, blocked);
  const visibleRows = rows.filter((row) => !blocked.has(row.actor));
  const actors = await getNotificationActors([
    ...new Set(visibleRows.map((row) => row.actor)),
  ]);
  const items = visibleRows.flatMap((row) => {
    const actor = actors.get(row.actor);
    return actor
      ? [
          {
            id: row.$id,
            type: row.type,
            actorId: row.actor,
            actorUsername: actor.username,
            actorAvatar: actor.avatar ?? "",
            instantId: row.instant ?? null,
            createdAt: row.$createdAt,
            read: row.read,
          },
        ]
      : [];
  });
  return {
    items,
    nextCursor: rows.length === 50 ? rows[rows.length - 1].$id : null,
    unreadCount,
  };
}

export async function readNotifications(
  userId: string,
  notificationIds: string[],
): Promise<void> {
  const blocked = await getBlockedUserIds(userId);
  const ownedRows: NotificationRow[] = [];
  for (const id of notificationIds) {
    const row = await getTables()
      .getRow<NotificationRow>({
        databaseId: getDatabaseId(),
        tableId: "notifications",
        rowId: id,
      })
      .catch((error: unknown) => {
        if (error instanceof AppwriteException && error.code === 404) {
          return null;
        }
        throw error;
      });
    if (row?.recipient === userId && !blocked.has(row.actor)) {
      ownedRows.push(row);
    }
  }
  await markNotificationsRead(userId, ownedRows.map((row) => row.$id));
}

async function getUnreadCount(
  userId: string,
  blocked: Set<string>,
): Promise<number> {
  let count = 0;
  let cursor: string | null = null;
  while (true) {
    const result: Models.RowList<NotificationRow> =
      await getTables().listRows<NotificationRow>({
        databaseId: getDatabaseId(),
        tableId: "notifications",
        queries: [
          Query.equal("recipient", userId),
          Query.equal("read", false),
          Query.limit(100),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
          Query.select(["$id", "actor"]),
        ],
        total: false,
      });
    count += result.rows.filter((row) => !blocked.has(row.actor)).length;
    if (result.rows.length < 100) {
      return count;
    }
    const next: string = result.rows[result.rows.length - 1].$id;
    if (next === cursor) {
      throw new Error("Unable to continue reading notifications.");
    }
    cursor = next;
  }
}

export async function createNotification(
  recipient: string,
  actor: string,
  type: NotificationType,
  instant?: string,
): Promise<void> {
  await runTransaction((transactionId) =>
    createNotificationInTransaction(
      recipient,
      actor,
      type,
      transactionId,
      instant,
    ),
  );
  await dispatchTelegramNotification(recipient, actor, type);
}

export async function dispatchTelegramNotification(
  recipient: string,
  actor: string,
  type: NotificationType,
): Promise<void> {
  try {
    after(async () => {
      try {
        const [actorProfile, recipientBlocks, actorBlocks] = await Promise.all([
          getTables().getRow({
            databaseId: getDatabaseId(),
            tableId: "users",
            rowId: actor,
          }),
          getBlockedUserIds(recipient),
          getBlockedUserIds(actor),
        ]);
        if (recipientBlocks.has(actor) || actorBlocks.has(recipient)) {
          return;
        }
        const username =
          typeof actorProfile.username === "string"
            ? actorProfile.username
            : "Someone";
        const message = {
          link_request: `@${username} sent you a link request.`,
          link_accepted: `@${username} accepted your link request.`,
          follow_request: `@${username} requested to follow you.`,
          follow_approved: `Your follow request to @${username} was approved.`,
          new_follower: `@${username} started following you.`,
          like: `@${username} liked your Instant.`,
        }[type];
        await sendTelegramNotification(recipient, message);
      } catch (error) {
        logTelegramFailure("delivery", error);
      }
    });
  } catch (error) {
    logTelegramFailure("scheduling", error);
  }
}

function logTelegramFailure(stage: "delivery" | "scheduling", error: unknown) {
  const detail =
    error instanceof AppwriteException
      ? `Appwrite ${error.code} (${error.type})`
      : error instanceof Error
        ? error.name
        : "UnknownError";
  console.error(`Telegram notification ${stage} failed: ${detail}`);
}
