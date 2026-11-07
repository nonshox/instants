import { apiClient } from "@/src/lib/api-client";

export type Relationship =
  | "self"
  | "following"
  | "requested"
  | "incoming"
  | "not_following"
  | "blocked";

export type SocialProfile = {
  username: string;
  name: string;
  bio: string;
  private: boolean;
  followers: number | null;
  following: number | null;
  relationship: Relationship;
};

export type FollowRequest = { username: string };
export type ConnectionItem = {
  username: string;
  name?: string;
  private?: boolean;
  relationship?: "following" | "requested" | "not_following";
};
export type ConnectionPage = {
  items: ConnectionItem[];
  nextCursor: string | null;
  count?: number;
};

export async function fetchConnections(
  kind: "followers" | "following",
  cursor: string | null = null,
): Promise<ConnectionPage> {
  const { data } = await apiClient.get<ConnectionPage>(
    "/social/relationships",
    { params: { kind, ...(cursor ? { cursor } : {}) } },
  );
  return data;
}

export async function fetchFollowRequests(
  direction: "received" | "sent" = "received",
  cursor: string | null = null,
): Promise<ConnectionPage> {
  const { data } = await apiClient.get<ConnectionPage>("/social/requests", {
    params: { direction, ...(cursor ? { cursor } : {}) },
  });
  return data;
}

export async function fetchBlockedAccounts(
  cursor: string | null = null,
): Promise<ConnectionPage> {
  const { data } = await apiClient.get<ConnectionPage>("/social/blocks", {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}

export async function searchSocialProfile(
  username: string,
): Promise<SocialProfile> {
  const { data } = await apiClient.get<{ profile: SocialProfile }>(
    "/social/profiles",
    { params: { username } },
  );
  return data.profile;
}

export async function updateRelationship(
  username: string,
  remove: boolean,
  direction?: "follower",
): Promise<Relationship | null> {
  if (remove) {
    await apiClient.delete("/social/relationships", {
      params: { username, ...(direction ? { direction } : {}) },
    });
    return null;
  }
  const { data } = await apiClient.post<{ relationship: Relationship }>(
    "/social/relationships",
    { username },
  );
  return data.relationship;
}

export async function decideFollowRequest(
  username: string,
  action: "approve" | "reject",
): Promise<void> {
  await apiClient.patch("/social/requests", { username, action });
}

export async function updateBlock(
  username: string,
  blocked: boolean,
): Promise<SocialProfile | null> {
  if (blocked) {
    await apiClient.delete("/social/blocks", { params: { username } });
    return searchSocialProfile(username);
  }
  await apiClient.post("/social/blocks", { username });
  return null;
}

export async function removeIncomingFollower(username: string): Promise<void> {
  await apiClient.delete("/social/relationships", {
    params: { username, direction: "follower" },
  });
}
