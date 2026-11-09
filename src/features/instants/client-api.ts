import { apiClient } from "@/src/lib/api-client";

export type FeedInstant = {
  id: string;
  ownerId: string;
  username: string;
  avatar: string;
  caption: string;
  /** Total reactions on the Instant (shared like counter). */
  likes: number;
  /** Viewer's reaction emoji, or null when the viewer has not reacted. */
  reaction: string | null;
  createdAt: string;
  imageUrl: string;
};

export type FeedPage = {
  items: FeedInstant[];
  nextCursor: string | null;
  hasMore: boolean;
};

export async function fetchFeedPage(cursor: string | null): Promise<FeedPage> {
  const { data } = await apiClient.get<FeedPage>("/instants", {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}

export async function uploadInstant(
  localId: string,
  image: Blob,
  mimeType: string,
  caption: string,
): Promise<string> {
  const form = new FormData();
  form.append("localId", localId);
  form.append("image", new File([image], "instant-upload", { type: mimeType }));
  form.append("caption", caption);
  const { data } = await apiClient.post<{ instant: { id: string } }>(
    "/instants",
    form,
  );
  return data.instant.id;
}

export async function setInstantReaction(
  instantId: string,
  emoji: string | null,
): Promise<{ reaction: string | null; reactions: number }> {
  if (emoji === null) {
    const { data } = await apiClient.request<{
      reaction: { reaction: string | null; reactions: number };
    }>({
      url: `/instants/${encodeURIComponent(instantId)}/reaction`,
      method: "DELETE",
    });
    return data.reaction;
  }
  const { data } = await apiClient.put<{
    reaction: { reaction: string | null; reactions: number };
  }>(`/instants/${encodeURIComponent(instantId)}/reaction`, { emoji });
  return data.reaction;
}

export type OwnEngagementInstant = {
  id: string;
  caption: string;
  likes: number;
  createdAt: string;
  expires: string;
  reactions: Record<string, number>;
  viewers: {
    userId: string;
    seenAt: string;
    reaction: string | null;
  }[];
};

export type ResolvedProfile = {
  id: string;
  username: string;
  avatar: string;
  resolvable: boolean;
};

/** Snapshot of the owner's own Instants with engagement, from the server. */
export async function fetchOwnEngagement(): Promise<OwnEngagementInstant[]> {
  const { data } = await apiClient.get<{ instants: OwnEngagementInstant[] }>(
    "/instants/mine",
  );
  return data.instants;
}

/** Resolves local engagement ids to CURRENT public identities (linked only). */
export async function resolveViewerProfiles(
  ids: string[],
): Promise<Map<string, ResolvedProfile>> {
  if (ids.length === 0) {
    return new Map();
  }
  const { data } = await apiClient.post<{ profiles: ResolvedProfile[] }>(
    "/auth/resolve-profiles",
    { ids },
  );
  return new Map(data.profiles.map((profile) => [profile.id, profile]));
}

export type InstantViewer = {
  userId: string;
  username: string;
  avatar: string;
  seenAt: string;
  reaction: string | null;
};

/** Fire-and-forget: records that the caller dealt with an Instant. */
export async function recordInstantView(instantId: string): Promise<void> {
  await apiClient.post(
    `/instants/${encodeURIComponent(instantId)}/views`,
    {},
  );
}

/** Owner-only: who has dealt or reacted to one of their own Instants. */
export async function fetchInstantViewers(
  instantId: string,
): Promise<InstantViewer[]> {
  const { data } = await apiClient.get<{ viewers: InstantViewer[] }>(
    `/instants/${encodeURIComponent(instantId)}/views`,
  );
  return data.viewers;
}

export async function updateInstantCaption(
  instantId: string,
  caption: string,
): Promise<{ id: string; caption: string }> {
  const { data } = await apiClient.patch<{
    instant: { id: string; caption: string };
  }>(`/instants/${encodeURIComponent(instantId)}`, { caption });
  return data.instant;
}

export async function deleteInstant(instantId: string): Promise<void> {
  await apiClient.delete(`/instants/${encodeURIComponent(instantId)}`);
}
