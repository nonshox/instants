import "server-only";
import { AppwriteException, Query, type Models } from "node-appwrite";
import {
  getDatabaseId,
  getTables,
  type BlockRow,
  type UserPrivacyRow,
} from "@/src/features/instants/data";
import type { NotificationRow } from "./types";

export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const [blocking, blockedBy] = await Promise.all([
    listBlockRows("blocker", userId),
    listBlockRows("blocked", userId),
  ]);
  return new Set([
    ...blocking.map((row) => row.blocked),
    ...blockedBy.map((row) => row.blocker),
  ]);
}

export async function getNotificationRows(
  userId: string,
  cursor: string | null,
): Promise<NotificationRow[]> {
  const result = await getTables().listRows<NotificationRow>({
    databaseId: getDatabaseId(),
    tableId: "notifications",
    queries: [
      Query.equal("recipient", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(50),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ],
    total: false,
  });
  return result.rows;
}

export async function getNotificationActors(
  actorIds: string[],
): Promise<Map<string, UserPrivacyRow>> {
  if (actorIds.length === 0) {
    return new Map();
  }
  const result = await getTables().listRows<UserPrivacyRow>({
    databaseId: getDatabaseId(),
    tableId: "users",
    queries: [
      Query.equal("$id", actorIds),
      Query.limit(100),
      Query.select(["$id", "username", "avatar"]),
    ],
    total: false,
  });
  return new Map(result.rows.map((row) => [row.$id, row]));
}

export async function markNotificationsRead(
  userId: string,
  notificationIds: string[],
): Promise<void> {
  for (const notificationId of notificationIds) {
    try {
      const row = await getTables().getRow<NotificationRow>({
        databaseId: getDatabaseId(),
        tableId: "notifications",
        rowId: notificationId,
      });
      if (row.recipient !== userId || row.read) {
        continue;
      }
      await getTables().updateRow({
        databaseId: getDatabaseId(),
        tableId: "notifications",
        rowId: row.$id,
        data: { read: true },
      });
    } catch (error) {
      if (error instanceof AppwriteException && error.code === 404) {
        continue;
      }
      throw error;
    }
  }
}

async function listBlockRows(
  key: "blocker" | "blocked",
  userId: string,
): Promise<BlockRow[]> {
  const rows: BlockRow[] = [];
  let cursor: string | null = null;
  while (true) {
    const result: Models.RowList<BlockRow> = await getTables().listRows<BlockRow>({
      databaseId: getDatabaseId(),
      tableId: "blocks",
      queries: [
        Query.equal(key, userId),
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    rows.push(...result.rows);
    if (result.rows.length < 100) {
      return rows;
    }
    const nextCursor: string = result.rows[result.rows.length - 1].$id;
    if (nextCursor === cursor) {
      throw new Error("Unable to continue reading blocks.");
    }
    cursor = nextCursor;
  }
}
