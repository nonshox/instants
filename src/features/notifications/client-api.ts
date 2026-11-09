import { apiClient } from "@/src/lib/api-client";

export type NotificationItem = {
  id: string;
  type:
    | "link_request"
    | "link_accepted"
    | "follow_request"
    | "follow_approved"
    | "new_follower"
    | "like";
  actorId: string;
  actorUsername: string;
  actorAvatar: string;
  instantId: string | null;
  createdAt: string;
  read: boolean;
  count: number;
  ids: string[];
};

export type NotificationPage = {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
};

export async function fetchNotifications(
  cursor: string | null,
): Promise<NotificationPage> {
  const { data } = await apiClient.get<NotificationPage>("/notifications", {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch("/notifications", { ids: [id] });
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await apiClient.patch("/notifications", { ids });
}
