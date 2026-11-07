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

export async function fetchFollowRequests(): Promise<FollowRequest[]> {
  const { data } = await apiClient.get<{ requests: FollowRequest[] }>(
    "/social/requests",
  );
  return data.requests;
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
): Promise<Relationship | null> {
  if (remove) {
    await apiClient.delete("/social/relationships", {
      params: { username },
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
