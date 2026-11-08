import "server-only";
import { Query, type Models } from "node-appwrite";
import { canViewProfileDetails } from "@/src/features/social/policy";
import {
  findLink,
  findRelationship,
  findUserByUsername,
  getDatabaseId,
  getTables,
} from "./data";
import {
  SocialError,
  type LinkRow,
  type PublicProfile,
  type RequestRow,
  type UserRow,
} from "./types";

export async function getProfileForViewer(
  viewerId: string,
  username: string,
): Promise<PublicProfile> {
  const target = await findUserByUsername(username);
  if (!target) {
    throw new SocialError("PROFILE_NOT_FOUND");
  }
  if (target.$id === viewerId) {
    return toPublicProfile(
      target,
      "self",
      canViewProfileDetails(target.private, true, false),
    );
  }

  const [ownBlock, otherBlock] = await Promise.all([
    findRelationship("blocks", "blocker", viewerId, "blocked", target.$id),
    findRelationship("blocks", "blocker", target.$id, "blocked", viewerId),
  ]);
  if (otherBlock) {
    throw new SocialError("BLOCKED");
  }
  if (ownBlock) {
    return toPublicProfile(target, "blocked", false);
  }

  const [link, outgoingRequest, incomingRequest] = await Promise.all([
    findLink(viewerId, target.$id),
    findRelationship("requests", "requester", viewerId, "target", target.$id),
    findRelationship("requests", "requester", target.$id, "target", viewerId),
  ]);

  if (link) {
    return toPublicProfile(
      target,
      "linked",
      canViewProfileDetails(target.private, false, true),
    );
  }
  if (outgoingRequest) {
    return toPublicProfile(
      target,
      "requested",
      canViewProfileDetails(target.private, false, false),
    );
  }
  if (incomingRequest) {
    return toPublicProfile(
      target,
      "incoming",
      canViewProfileDetails(target.private, false, false),
    );
  }
  return toPublicProfile(
    target,
    "not_linked",
    canViewProfileDetails(target.private, false, false),
  );
}

function toPublicProfile(
  row: UserRow,
  relationship: PublicProfile["relationship"],
  showDetails: boolean,
): PublicProfile {
  return {
    id: row.$id,
    username: row.username,
    name: showDetails ? row.name : "",
    bio: showDetails ? row.bio : "",
    avatar: showDetails ? row.avatar : "",
    private: row.private,
    links: showDetails ? (row.links ?? 0) : null,
    relationship,
  };
}

export async function listIncomingRequests(
  userId: string,
  cursor: string | null = null,
): Promise<ConnectionPage> {
  return listRequestRows(userId, "target", cursor);
}

export async function listOutgoingRequests(
  userId: string,
  cursor: string | null = null,
): Promise<ConnectionPage> {
  return listRequestRows(userId, "requester", cursor);
}

export async function listConnections(
  userId: string,
  cursor: string | null = null,
): Promise<ConnectionPage> {
  const result = await getTables().listRows<LinkRow>({
    databaseId: getDatabaseId(),
    tableId: "follows",
    queries: [
      Query.or([
        Query.equal("follower", userId),
        Query.equal("following", userId),
      ]),
      Query.orderDesc("$createdAt"),
      Query.limit(26),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
      Query.select(["$id", "$createdAt", "follower", "following"]),
    ],
    total: false,
  });
  const pageRows = result.rows.slice(0, 25);
  const otherIds = [
    ...new Set(
      pageRows.map((row) =>
        row.follower === userId ? row.following : row.follower,
      ),
    ),
  ];
  const [users, blockedIds] = await Promise.all([
    getUsers(otherIds),
    getBlockedIds(userId),
  ]);

  return {
    items: pageRows.flatMap((row) => {
      const id = row.follower === userId ? row.following : row.follower;
      const user = users.get(id);
      if (!user || blockedIds.has(id)) return [];
      return [
        {
          id: user.$id,
          username: user.username,
          name: user.name,
          private: user.private,
          avatar: user.avatar,
        },
      ];
    }),
    nextCursor:
      result.rows.length > 25
        ? (pageRows[pageRows.length - 1]?.$id ?? null)
        : null,
  };
}

export async function listBlockedAccounts(
  userId: string,
  cursor: string | null = null,
): Promise<ConnectionPage> {
  const result = await getTables().listRows<Models.Row & { blocked: string }>({
    databaseId: getDatabaseId(),
    tableId: "blocks",
    queries: [
      Query.equal("blocker", userId),
      Query.orderDesc("$createdAt"),
      Query.limit(26),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
      Query.select(["$id", "$createdAt", "blocked"]),
    ],
    total: false,
  });
  const pageRows = result.rows.slice(0, 25);
  const users = await getUsers(pageRows.map((row) => row.blocked));
  return {
    items: pageRows.flatMap((row) => {
      const user = users.get(row.blocked);
      return user
        ? [{ id: user.$id, username: user.username, name: user.name, avatar: user.avatar }]
        : [];
    }),
    nextCursor:
      result.rows.length > 25
        ? (pageRows[pageRows.length - 1]?.$id ?? null)
        : null,
  };
}

type ConnectionItem = {
  id?: string;
  username: string;
  name?: string;
  private?: boolean;
  avatar?: string;
};

type ConnectionPage = {
  items: ConnectionItem[];
  nextCursor: string | null;
  count?: number;
};

async function listRequestRows(
  userId: string,
  key: "requester" | "target",
  cursor: string | null,
): Promise<ConnectionPage> {
  const result = await getTables().listRows<RequestRow>({
    databaseId: getDatabaseId(),
    tableId: "requests",
    queries: [
      Query.equal(key, userId),
      Query.orderDesc("$createdAt"),
      Query.limit(26),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
      Query.select(["$id", "$createdAt", "requester", "target"]),
    ],
    total: key === "target",
  });
  const pageRows = result.rows.slice(0, 25);
  const userIds = pageRows.map((row) =>
    key === "target" ? row.requester : row.target,
  );
  const [users, blockedIds] = await Promise.all([
    getUsers(userIds),
    getBlockedIds(userId),
  ]);
  return {
    items: pageRows.flatMap((row) => {
      const id = key === "target" ? row.requester : row.target;
      const user = users.get(id);
      return user && !blockedIds.has(id)
        ? [
            {
              id: user.$id,
              username: user.username,
              name: user.name,
              avatar: user.avatar,
            },
          ]
        : [];
    }),
    nextCursor:
      result.rows.length > 25
        ? (pageRows[pageRows.length - 1]?.$id ?? null)
        : null,
    ...(key === "target" ? { count: result.total } : {}),
  };
}

async function getUsers(userIds: string[]): Promise<Map<string, UserRow>> {
  if (userIds.length === 0) return new Map();
  const result = await getTables().listRows<UserRow>({
    databaseId: getDatabaseId(),
    tableId: "users",
    queries: [
      Query.equal("$id", userIds),
      Query.limit(100),
      Query.select(["$id", "username", "name", "private", "links", "avatar"]),
    ],
    total: false,
  });
  return new Map(result.rows.map((row) => [row.$id, row]));
}

async function getBlockedIds(userId: string): Promise<Set<string>> {
  const [blocking, blockedBy] = await Promise.all([
    listBlockRows("blocker", userId),
    listBlockRows("blocked", userId),
  ]);
  return new Set([...blocking, ...blockedBy]);
}

async function listBlockRows(
  key: "blocker" | "blocked",
  userId: string,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  while (true) {
    const result: Models.RowList<
      Models.Row & { blocker: string; blocked: string }
    > = await getTables().listRows({
      databaseId: getDatabaseId(),
      tableId: "blocks",
      queries: [
        Query.equal(key, userId),
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
        Query.select(["$id", "blocker", "blocked"]),
      ],
      total: false,
    });
    ids.push(
      ...result.rows.map((row) =>
        key === "blocker" ? row.blocked : row.blocker,
      ),
    );
    if (result.rows.length < 100) return ids;
    const nextCursor = result.rows[result.rows.length - 1].$id;
    if (nextCursor === cursor) {
      throw new Error("Unable to continue reading blocked accounts.");
    }
    cursor = nextCursor;
  }
}
