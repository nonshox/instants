import { apiClient } from "@/src/lib/api-client";

export type Relationship =
  | "self"
  | "linked"
  | "requested"
  | "incoming"
  | "not_linked"
  | "blocked";

export type SocialProfile = {
  id: string;
  username: string;
  name: string;
  bio: string;
  avatar: string;
  private: boolean;
  links: number | null;
  relationship: Relationship;
};

export type ConnectionItem = {
  id?: string;
  username: string;
  name?: string;
  private?: boolean;
  avatar?: string;
};
export type ConnectionPage = {
  items: ConnectionItem[];
  nextCursor: string | null;
  count?: number;
};

export type LinkStatus = "linked" | "requested";

export async function fetchLinks(
  cursor: string | null = null,
): Promise<ConnectionPage> {
  const { data } = await apiClient.get<ConnectionPage>("/social/relationships", {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}

export async function fetchLinkRequests(
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

export async function requestLink(username: string): Promise<LinkStatus> {
  const { data } = await apiClient.post<{ relationship: LinkStatus }>(
    "/social/relationships",
    { username },
  );
  return data.relationship;
}

export async function removeLink(username: string): Promise<void> {
  await apiClient.delete("/social/relationships", { params: { username } });
}

export async function decideLinkRequest(
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
