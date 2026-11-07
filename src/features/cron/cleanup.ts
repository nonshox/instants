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

export async function runDailyCleanup(): Promise<{
  instantsDeleted: number;
  tokensDeleted: number;
  failures: number;
}> {
  const now = new Date().toISOString();
  const result = { instantsDeleted: 0, tokensDeleted: 0, failures: 0 };

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
      }
    },
  );

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
