import "server-only";
import { AppwriteException, ID, Query, TablesDB, type Models } from "node-appwrite";
import {
  createAdminClient,
  getAppwriteDatabaseId,
} from "@/src/lib/appwrite/server";
import { SocialError, type LinkRow, type UserRow } from "./types";

export const getTables = () => new TablesDB(createAdminClient());
export const getDatabaseId = () => getAppwriteDatabaseId();

export async function findUserByUsername(
  username: string,
): Promise<UserRow | null> {
  const result = await getTables().listRows<UserRow>({
    databaseId: getDatabaseId(),
    tableId: "users",
    queries: [Query.equal("username", username), Query.limit(1)],
    total: false,
  });
  return result.rows[0] ?? null;
}

export async function findRelationship<Row extends Models.Row = Models.Row>(
  tableId: "follows" | "requests" | "blocks",
  firstKey: "follower" | "requester" | "blocker",
  firstId: string,
  secondKey: "following" | "target" | "blocked",
  secondId: string,
): Promise<Row | null> {
  const result = await getTables().listRows<Row>({
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

/** A link is mutual, so the same row matches either direction. */
export async function findLink(
  firstId: string,
  secondId: string,
): Promise<LinkRow | null> {
  const result = await getTables().listRows<LinkRow>({
    databaseId: getDatabaseId(),
    tableId: "follows",
    queries: [
      Query.or([
        Query.and([
          Query.equal("follower", firstId),
          Query.equal("following", secondId),
        ]),
        Query.and([
          Query.equal("follower", secondId),
          Query.equal("following", firstId),
        ]),
      ]),
      Query.limit(1),
    ],
    total: false,
  });
  return result.rows[0] ?? null;
}

/** Links are stored once per pair in a stable order so duplicates are impossible. */
export function orderLinkPair(firstId: string, secondId: string): [string, string] {
  return firstId < secondId ? [firstId, secondId] : [secondId, firstId];
}

export async function assertNotBlocked(
  firstId: string,
  secondId: string,
): Promise<void> {
  const [forward, reverse] = await Promise.all([
    findRelationship("blocks", "blocker", firstId, "blocked", secondId),
    findRelationship("blocks", "blocker", secondId, "blocked", firstId),
  ]);
  if (forward || reverse) {
    throw new SocialError("BLOCKED");
  }
}

export async function runTransaction(
  operation: (transactionId: string) => Promise<void>,
  label = "Social transaction",
): Promise<void> {
  const service = getTables();
  let transactionId: string | null = null;
  let stage = "create";

  try {
    const transaction = await service.createTransaction({ ttl: 60 });
    transactionId = transaction.$id;
    stage = "stage operations";
    await operation(transactionId);
    stage = "commit";
    const result = await service.updateTransaction({
      transactionId,
      commit: true,
    });
    if (result.status !== "committed") {
      throw new Error(`Social transaction ended as ${result.status}.`);
    }
  } catch (error) {
    if (transactionId) {
      try {
        await service.updateTransaction({
          transactionId,
          rollback: true,
        });
      } catch (rollbackError) {
        logTransactionFailure(`${label} rollback`, rollbackError);
      }
    }
    logTransactionFailure(`${label} ${stage}`, error);
    throw error;
  }
}

function logTransactionFailure(operation: string, error: unknown): void {
  const detail =
    error instanceof AppwriteException
      ? `Appwrite ${error.code} (${error.type}): ${error.message}`
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : "UnknownError";
  console.error(`${operation} failed: ${detail}`);
}

export async function addLink(
  firstId: string,
  secondId: string,
  transactionId: string,
): Promise<void> {
  const service = getTables();
  const [follower, following] = orderLinkPair(firstId, secondId);
  await service.createRow<LinkRow>({
    databaseId: getDatabaseId(),
    tableId: "follows",
    rowId: ID.unique(),
    permissions: [],
    transactionId,
    data: { follower, following },
  });
  await Promise.all([
    service.incrementRowColumn({
      databaseId: getDatabaseId(),
      tableId: "users",
      rowId: follower,
      column: "links",
      value: 1,
      transactionId,
    }),
    service.incrementRowColumn({
      databaseId: getDatabaseId(),
      tableId: "users",
      rowId: following,
      column: "links",
      value: 1,
      transactionId,
    }),
  ]);
}

export async function removeLinkInTransaction(
  link: LinkRow,
  transactionId: string,
): Promise<void> {
  const service = getTables();
  await service.deleteRow({
    databaseId: getDatabaseId(),
    tableId: "follows",
    rowId: link.$id,
    transactionId,
  });
  await Promise.all([
    service.decrementRowColumn({
      databaseId: getDatabaseId(),
      tableId: "users",
      rowId: link.follower,
      column: "links",
      value: 1,
      min: 0,
      transactionId,
    }),
    service.decrementRowColumn({
      databaseId: getDatabaseId(),
      tableId: "users",
      rowId: link.following,
      column: "links",
      value: 1,
      min: 0,
      transactionId,
    }),
  ]);
}
