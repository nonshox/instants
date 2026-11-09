import "server-only";
import { AppwriteException, Query, type Models } from "node-appwrite";
import {
  getBucketId,
  getDatabaseId,
  getStorage,
  getTables,
  type InstantRow,
} from "@/src/features/instants/data";

const pageSize = 100;

// Read notifications older than this are purged by the daily cleanup.
// 0 = delete every already-read notification on each run. Unread rows are
// never deleted. Set e.g. 7 to keep a week of read history instead.
const READ_NOTIFICATIONS_RETENTION_DAYS = 0;

export async function runDailyCleanup(): Promise<{
  instantsDeleted: number;
  tokensDeleted: number;
  likesDeleted: number;
  viewsDeleted: number;
  notificationsDeleted: number;
  expiredNotificationsDeleted: number;
  failures: number;
}> {
  const now = new Date().toISOString();
  const result = {
    instantsDeleted: 0,
    tokensDeleted: 0,
    likesDeleted: 0,
    viewsDeleted: 0,
    notificationsDeleted: 0,
    expiredNotificationsDeleted: 0,
    failures: 0,
  };

  await scanExpiredRows<InstantRow>(
    "instants",
    [Query.lessThanEqual("expires", now), Query.orderAsc("expires")],
    async (row) => {
      try {
        await getStorage().deleteFile({
          bucketId: getBucketId(),
          fileId: row.image,
        });
      } catch (error) {
        if (!(error instanceof AppwriteException && error.code === 404)) {
          logCleanupFailure("Expired Instant file", error);
          result.failures += 1;
          return;
        }
      }

      try {
        await getTables().deleteRow({
          databaseId: getDatabaseId(),
          tableId: "instants",
          rowId: row.$id,
        });
        result.instantsDeleted += 1;
      } catch (error) {
        logCleanupFailure("Expired Instant row", error);
        result.failures += 1;
        return;
      }

      await purgeReactionsAndViews(row.$id, result);
    },
  );

  await purgeReadNotifications(result);

  await scanExpiredRows<Models.Row & { expires: string }>(
    "tg_tokens",
    [Query.lessThanEqual("expires", now), Query.orderAsc("expires")],
    async (row) => {
      try {
        await getTables().deleteRow({
          databaseId: getDatabaseId(),
          tableId: "tg_tokens",
          rowId: row.$id,
        });
        result.tokensDeleted += 1;
      } catch (error) {
        logCleanupFailure("Expired Telegram token", error);
        result.failures += 1;
      }
    },
  );

  return result;
}

/** Delete already-read notifications; unread rows are never touched. */
async function purgeReadNotifications(
  result: { notificationsDeleted: number; failures: number },
): Promise<void> {
  const cutoff =
    READ_NOTIFICATIONS_RETENTION_DAYS > 0
      ? new Date(
          Date.now() - READ_NOTIFICATIONS_RETENTION_DAYS * 86_400_000,
        ).toISOString()
      : null;

  // Phase 1: collect IDs without deleting — deleting while paginating a
  // cursor can skip rows. Capped at 5k per run; the rest goes tomorrow.
  const rowIds: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 25 && rowIds.length < 5000; page += 1) {
    const queries = [
      Query.equal("read", true),
      Query.orderAsc("$createdAt"),
      Query.limit(200),
      Query.select(["$id"]),
      ...(cutoff ? [Query.lessThanEqual("$createdAt", cutoff)] : []),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ];
    const listed: Models.RowList<Models.Row> = await getTables().listRows<Models.Row>({
      databaseId: getDatabaseId(),
      tableId: "notifications",
      queries,
      total: false,
    });
    for (const row of listed.rows) {
      rowIds.push(row.$id);
    }
    if (listed.rows.length < 200) {
      break;
    }
    cursor = listed.rows[listed.rows.length - 1].$id;
  }

  // Phase 2: delete the collected rows; failures are logged, never fatal.
  for (const rowId of rowIds) {
    try {
      await getTables().deleteRow({
        databaseId: getDatabaseId(),
        tableId: "notifications",
        rowId,
      });
      result.notificationsDeleted += 1;
    } catch (error) {
      logCleanupFailure("Read notification", error);
      result.failures += 1;
    }
  }
}

/** Delete every reaction, view, and notification row for an instant going away. */
async function purgeReactionsAndViews(
  instantId: string,
  result: {
    likesDeleted: number;
    viewsDeleted: number;
    expiredNotificationsDeleted: number;
    failures: number;
  },
): Promise<void> {
  for (const tableId of ["likes", "views", "notifications"] as const) {
    // Phase 1: collect IDs without deleting, so a cursor never points at
    // a deleted row. Capped per run — remainder is picked up by the next.
    const rowIds: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10 && rowIds.length < 1000; page += 1) {
      const listed: Models.RowList<Models.Row> = await getTables().listRows<
        Models.Row
      >({
        databaseId: getDatabaseId(),
        tableId,
        queries: [
          Query.equal("instant", instantId),
          Query.limit(100),
          Query.select(["$id"]),
          ...(cursor ? [Query.cursorAfter(cursor)] : []),
        ],
        total: false,
      });
      for (const row of listed.rows) {
        rowIds.push(row.$id);
      }
      if (listed.rows.length < 100) {
        break;
      }
      cursor = listed.rows[listed.rows.length - 1].$id;
    }

    // Phase 2: delete the collected rows.
    for (const rowId of rowIds) {
      try {
        await getTables().deleteRow({
          databaseId: getDatabaseId(),
          tableId,
          rowId,
        });
        if (tableId === "likes") {
          result.likesDeleted += 1;
        } else if (tableId === "views") {
          result.viewsDeleted += 1;
        } else {
          result.expiredNotificationsDeleted += 1;
        }
      } catch (error) {
        logCleanupFailure(`${tableId} row for ${instantId}`, error);
        result.failures += 1;
      }
    }
  }
}

async function scanExpiredRows<Row extends Models.Row>(
  tableId: "instants" | "tg_tokens",
  filters: string[],
  remove: (row: Row) => Promise<void>,
): Promise<void> {
  let scanned = 0;
  let cursor: string | null = null;
  while (scanned < 500) {
    const result: Models.RowList<Row> = await getTables().listRows<Row>({
      databaseId: getDatabaseId(),
      tableId,
      queries: [
        ...filters,
        Query.limit(Math.min(pageSize, 500 - scanned)),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
        Query.select(
          tableId === "instants"
            ? ["$id", "image", "expires"]
            : ["$id", "expires"],
        ),
      ],
      total: false,
    });
    if (result.rows.length === 0) return;

    scanned += result.rows.length;
    for (const row of result.rows) {
      await remove(row);
    }

    const next = result.rows[result.rows.length - 1].$id;
    if (next === cursor) {
      throw new Error(`Unable to continue ${tableId} cleanup.`);
    }
    cursor = next;
    if (result.rows.length < pageSize) return;
  }
}

function logCleanupFailure(operation: string, error: unknown): void {
  const detail =
    error instanceof AppwriteException
      ? `Appwrite ${error.code}`
      : error instanceof Error
        ? error.name
        : "UnknownError";
  console.error(`${operation} cleanup failed: ${detail}`);
}
