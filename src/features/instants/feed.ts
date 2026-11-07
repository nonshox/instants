import "server-only";
import { Query, type Models } from "node-appwrite";
import {
  getDatabaseId,
  getTables,
  type BlockRow,
  type FollowRow,
  type InstantRow,
  type UserPrivacyRow,
} from "./data";

const pageSize = 20;
const querySize = 100;
const maxScanned = 500;

export type FeedInstant = {
  id: string;
  username: string;
  caption: string;
  likes: number;
  likedByViewer: boolean;
  createdAt: string;
  imageUrl: string;
};

export type FeedPage = {
  items: FeedInstant[];
  nextCursor: string | null;
  hasMore: boolean;
};

export async function getFeedPage(
  viewerId: string,
  cursor: string | null,
): Promise<FeedPage> {
  const [following, blocked] = await Promise.all([
    listFollowingIds(viewerId),
    listBlockedIds(viewerId),
  ]);
  if (following.size === 0) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  let queryCursor = cursor;
  let scanned = 0;
  let lastScanned: string | null = null;
  const items: FeedInstant[] = [];

  while (scanned < maxScanned) {
    const queries = [
      Query.notEqual("user", viewerId),
      Query.orderDesc("expires"),
      Query.limit(querySize),
      ...(queryCursor ? [Query.cursorAfter(queryCursor)] : []),
      Query.select(["$id", "$createdAt", "user", "image", "expires", "likes", "cap"]),
    ];
    const result = await getTables().listRows<InstantRow>({
      databaseId: getDatabaseId(),
      tableId: "instants",
      queries,
      total: false,
    });
    const rows = result.rows;
    if (rows.length === 0) {
      return { items, nextCursor: null, hasMore: false };
    }

    scanned += rows.length;
    lastScanned = rows[rows.length - 1].$id;
    queryCursor = lastScanned;

    const visibleRows = rows.filter(
      (row) => following.has(row.user) && !blocked.has(row.user),
    );
    if (visibleRows.length > 0) {
      const profiles = await getProfiles(
        [...new Set(visibleRows.map((row) => row.user))],
      );
      for (const row of visibleRows) {
        const owner = profiles.get(row.user);
        if (!owner) {
          continue;
        }
        items.push({
          id: row.$id,
          username: owner.username,
          caption: row.cap,
          likes: row.likes,
          likedByViewer: false,
          createdAt: row.$createdAt,
          imageUrl: `/api/instants/${row.$id}/image`,
        });
        if (items.length > pageSize) {
          return {
            items: await addViewerLikes(items.slice(0, pageSize), viewerId),
            nextCursor: items[pageSize - 1].id,
            hasMore: true,
          };
        }
      }
    }

    if (rows.length < querySize) {
      return {
        items: await addViewerLikes(items, viewerId),
        nextCursor: null,
        hasMore: false,
      };
    }
  }

  return {
    items: await addViewerLikes(items, viewerId),
    nextCursor: lastScanned,
    hasMore: Boolean(lastScanned),
  };
}

async function addViewerLikes(
  items: FeedInstant[],
  viewerId: string,
): Promise<FeedInstant[]> {
  if (items.length === 0) {
    return items;
  }
  const result = await getTables().listRows<Models.Row & { instant: string }>({
    databaseId: getDatabaseId(),
    tableId: "likes",
    queries: [
      Query.equal("user", viewerId),
      Query.equal("instant", items.map((item) => item.id)),
      Query.limit(pageSize),
      Query.select(["instant"]),
    ],
    total: false,
  });
  const likedIds = new Set(result.rows.map((row) => row.instant));
  return items.map((item) => ({
    ...item,
    likedByViewer: likedIds.has(item.id),
  }));
}

async function listFollowingIds(viewerId: string): Promise<Set<string>> {
  const rows = await listAllRows<FollowRow>(
    "follows",
    Query.equal("follower", viewerId),
  );
  return new Set(rows.map((row) => row.following));
}

async function listBlockedIds(viewerId: string): Promise<Set<string>> {
  const [blockedByViewer, blockedViewer] = await Promise.all([
    listAllRows<BlockRow>("blocks", Query.equal("blocker", viewerId)),
    listAllRows<BlockRow>("blocks", Query.equal("blocked", viewerId)),
  ]);
  return new Set([
    ...blockedByViewer.map((row) => row.blocked),
    ...blockedViewer.map((row) => row.blocker),
  ]);
}

async function listAllRows<Row extends Models.Row>(
  tableId: "follows" | "blocks",
  filter: string,
): Promise<Row[]> {
  const rows: Row[] = [];
  let cursor: string | null = null;

  while (true) {
    const result: Models.RowList<Row> = await getTables().listRows<Row>({
      databaseId: getDatabaseId(),
      tableId,
      queries: [
        filter,
        Query.limit(querySize),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    rows.push(...result.rows);
    if (result.rows.length < querySize) {
      return rows;
    }
    const nextCursor: string = result.rows[result.rows.length - 1].$id;
    if (nextCursor === cursor) {
      throw new Error(`Unable to continue reading ${tableId}.`);
    }
    cursor = nextCursor;
  }
}

async function getProfiles(userIds: string[]): Promise<Map<string, UserPrivacyRow>> {
  const result = await getTables().listRows<UserPrivacyRow>({
    databaseId: getDatabaseId(),
    tableId: "users",
    queries: [
      Query.equal("$id", userIds),
      Query.limit(querySize),
      Query.select(["$id", "username", "private"]),
    ],
    total: false,
  });
  return new Map(result.rows.map((row) => [row.$id, row]));
}
