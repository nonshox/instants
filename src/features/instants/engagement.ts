import "server-only";
import { Query, type Models } from "node-appwrite";
import {
  getDatabaseId,
  getTables,
  type InstantRow,
} from "./data";
import { normalizeReaction } from "./reactions";

export type EngagementViewer = {
  userId: string;
  seenAt: string;
  reaction: string | null;
};

export type EngagementInstant = {
  id: string;
  caption: string;
  /** Total reactions (shared like counter). */
  likes: number;
  createdAt: string;
  expires: string;
  /** Reaction emoji → count, from the backing likes rows. */
  reactions: Record<string, number>;
  /** Per-viewer engagement: who saw it + their reaction. */
  viewers: EngagementViewer[];
};

/**
 * Snapshot of the owner's own Instants with full engagement — the client
 * archives this into IndexedDB, then the daily cleanup may purge every
 * server-side trace. Two batched queries total, no per-Instant fan-out.
 */
export async function getOwnEngagement(
  ownerId: string,
): Promise<EngagementInstant[]> {
  const own = await getTables().listRows<InstantRow>({
    databaseId: getDatabaseId(),
    tableId: "instants",
    queries: [
      Query.equal("user", ownerId),
      Query.limit(500),
      Query.orderDesc("expires"),
      Query.select(["$id", "$createdAt", "expires", "likes", "cap"]),
    ],
    total: false,
  });
  if (own.rows.length === 0) {
    return [];
  }
  const ids = own.rows.map((row) => row.$id);

  const [likes, views] = await Promise.all([
    getTables().listRows<
      Models.Row & { instant: string; user: string; emoji?: string | null }
    >({
      databaseId: getDatabaseId(),
      tableId: "likes",
      queries: [
        Query.equal("instant", ids),
        Query.limit(5000),
        Query.select(["instant", "user", "emoji"]),
      ],
      total: false,
    }),
    getTables().listRows<Models.Row & { instant: string; user: string; seen: string }>({
      databaseId: getDatabaseId(),
      tableId: "views",
      queries: [
        Query.equal("instant", ids),
        Query.limit(5000),
        Query.orderDesc("seen"),
        Query.select(["instant", "user", "seen"]),
      ],
      total: false,
    }),
  ]);

  const reactionsByInstant = new Map<string, Map<string, number>>();
  const viewersByInstant = new Map<string, Map<string, EngagementViewer>>();

  for (const row of likes.rows) {
    const emoji = normalizeReaction(row.emoji);
    const map = reactionsByInstant.get(row.instant) ?? new Map();
    map.set(emoji, (map.get(emoji) ?? 0) + 1);
    reactionsByInstant.set(row.instant, map);

    const viewers = viewersByInstant.get(row.instant) ?? new Map();
    viewers.set(row.user, {
      userId: row.user,
      seenAt: "",
      reaction: emoji,
    });
    viewersByInstant.set(row.instant, viewers);
  }

  for (const row of views.rows) {
    const viewers = viewersByInstant.get(row.instant) ?? new Map();
    const existing = viewers.get(row.user);
    viewers.set(row.user, {
      userId: row.user,
      seenAt: row.seen,
      reaction: existing?.reaction ?? null,
    });
    viewersByInstant.set(row.instant, viewers);
  }

  return own.rows.map((row) => {
    const engagementByViewer = viewersByInstant.get(row.$id);
    return {
      id: row.$id,
      caption: row.cap,
      likes: row.likes,
      createdAt: row.$createdAt,
      expires: row.expires,
      reactions: Object.fromEntries(
        [...(reactionsByInstant.get(row.$id)?.entries() ?? [])].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
        ),
      ),
      viewers: [...(engagementByViewer?.values() ?? [])],
    };
  });
}
