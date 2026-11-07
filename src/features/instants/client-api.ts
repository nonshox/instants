import { apiClient } from "@/src/lib/api-client";

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

export async function setInstantLike(
  instantId: string,
  liked: boolean,
): Promise<{ liked: boolean; likes: number }> {
  const { data } = await apiClient.request<{
    like: { liked: boolean; likes: number };
  }>({
    url: `/instants/${encodeURIComponent(instantId)}/like`,
    method: liked ? "PUT" : "DELETE",
  });
  return data.like;
}

export async function deleteInstant(instantId: string): Promise<void> {
  await apiClient.delete(`/instants/${encodeURIComponent(instantId)}`);
}
