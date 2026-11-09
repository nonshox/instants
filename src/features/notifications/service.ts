import "server-only";
import { AppwriteException, ID } from "node-appwrite";
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
            count: 1,
            ids: [row.$id],
          },
        ]
      : [];
  });
  const grouped = collapseReactionGroups(items);
  const visibleUnreadCount = grouped
    .filter((item) => !item.read)
    .reduce((sum, item) => sum + item.count, 0);
  return {
    items: grouped,
    nextCursor: rows.length === 50 ? rows[rows.length - 1].$id : null,
    unreadCount: visibleUnreadCount,
  };
}

const REACTION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Collapse consecutive like notifications from the same actor within a 24h
 * window into a single grouped row. Keeps the latest createdAt as the
 * representative time; summed ids let the client mark the whole group read.
 */
function collapseReactionGroups(
  items: NotificationItem[],
): NotificationItem[] {
  const output: NotificationItem[] = [];
  for (const item of items) {
    if (item.type !== "like") {
      output.push(item);
      continue;
    }
    const last = output[output.length - 1];
    const sameActor = last?.type === "like" && last.actorId === item.actorId;
    const withinWindow =
      sameActor &&
      Math.abs(
        new Date(item.createdAt).getTime() - new Date(last.createdAt).getTime(),
      ) <= REACTION_WINDOW_MS;
    if (withinWindow) {
      output[output.length - 1] = {
        ...last,
        count: last.count + 1,
        ids: [...last.ids, ...item.ids],
        read: last.read && item.read,
        instantId: last.instantId ?? item.instantId,
      };
      continue;
    }
    output.push(item);
  }
  return output;
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
  reactionEmoji?: string,
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
          like:
            reactionEmoji != null
              ? `@${username} reacted with ${reactionEmoji} to your Instant.`
              : `@${username} liked your Instant.`,
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
