import "server-only";
import { Query } from "node-appwrite";
import { canViewProfileDetails } from "@/src/features/social/policy";
import {
  findRelationship,
  findUserByUsername,
  getDatabaseId,
  getTables,
} from "./data";
import {
  SocialError,
  type PublicProfile,
  type RelationshipRow,
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

  const [follow, outgoingRequest, incomingRequest] = await Promise.all([
    findRelationship<RelationshipRow>(
      "follows",
      "follower",
      viewerId,
      "following",
      target.$id,
    ),
    findRelationship("requests", "requester", viewerId, "target", target.$id),
    findRelationship("requests", "requester", target.$id, "target", viewerId),
  ]);

  if (follow) {
    return toPublicProfile(
      target,
      "following",
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
    "not_following",
    canViewProfileDetails(target.private, false, false),
  );
}

function toPublicProfile(
  row: UserRow,
  relationship: PublicProfile["relationship"],
  showDetails: boolean,
): PublicProfile {
  return {
    username: row.username,
    name: showDetails ? row.name : "",
    bio: showDetails ? row.bio : "",
    avatar: showDetails ? row.avatar : "",
    private: row.private,
    followers: showDetails ? row.followers : null,
    following: showDetails ? row.following : null,
    relationship,
  };
}

export async function listIncomingRequests(
  userId: string,
): Promise<Array<{ username: string }>> {
  const result = await getTables().listRows<RequestRow>({
    databaseId: getDatabaseId(),
    tableId: "requests",
    queries: [Query.equal("target", userId), Query.limit(25)],
    total: false,
  });
  if (result.rows.length === 0) {
    return [];
  }

  const users = await getTables().listRows<UserRow>({
    databaseId: getDatabaseId(),
    tableId: "users",
    queries: [
      Query.equal("$id", result.rows.map((row) => row.requester)),
      Query.limit(25),
      Query.select(["username"]),
    ],
    total: false,
  });
  const usernames = new Map(users.rows.map((row) => [row.$id, row.username]));
  return result.rows.flatMap((row) => {
    const requester = usernames.get(row.requester);
    return requester ? [{ username: requester }] : [];
  });
}
