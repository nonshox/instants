import "server-only";
import { Query, type Models } from "node-appwrite";
import { getDatabaseId, getTables, type LinkRow } from "../instants/data";

export type ResolvedProfile = {
  id: string;
  username: string;
  avatar: string;
  /** False when the requester is not linked with this id (or is not the id itself). */
  resolvable: boolean;
};

/**
 * Resolves local ids captured at engagement time against CURRENT profiles.
 * Requester must be the id itself or linked with it — anything else is a
 * private blank. One query for links, one for profiles. No fan-out per id.
 */
export async function resolveProfiles(
  requesterId: string,
  ids: string[],
): Promise<ResolvedProfile[]> {
  const unique = [...new Set(ids)].slice(0, 100);
  if (unique.length === 0) {
    return [];
  }

  const linked = await listLinkIds(requesterId);
  const resolvable = unique.filter(
    (id) => id === requesterId || linked.has(id),
  );

  const profiles =
    resolvable.length === 0
      ? []
      : (
          await getTables().listRows<
            Models.Row & { username: string; avatar: string }
          >({
            databaseId: getDatabaseId(),
            tableId: "users",
            queries: [
              Query.equal("$id", resolvable),
              Query.limit(100),
              Query.select(["$id", "username", "avatar"]),
            ],
            total: false,
          })
        ).rows;
  const profileById = new Map(profiles.map((row) => [row.$id, row]));

  return unique.map((id) => {
    const profile = profileById.get(id);
    return profile
      ? {
          id,
          username: profile.username,
          avatar: profile.avatar ?? "",
          resolvable: true,
        }
      : { id, username: "", avatar: "", resolvable: false };
  });
}

async function listLinkIds(requesterId: string): Promise<Set<string>> {
  const rows: LinkRow[] = [];
  let cursor: string | null = null;
  while (true) {
    const result: Models.RowList<LinkRow> = await getTables().listRows<LinkRow>({
      databaseId: getDatabaseId(),
      tableId: "follows",
      queries: [
        Query.or([
          Query.equal("follower", requesterId),
          Query.equal("following", requesterId),
        ]),
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    });
    rows.push(...result.rows);
    if (result.rows.length < 100) {
      return new Set(
        rows.map((row) =>
          row.follower === requesterId ? row.following : row.follower,
        ),
      );
    }
    cursor = result.rows[result.rows.length - 1].$id;
  }
}
