import { apiClient } from "@/src/lib/api-client";

export type NotificationItem = {
  id: string;
  type: "follow_request" | "follow_approved" | "new_follower" | "like";
  actorUsername: string;
  instantId: string | null;
  createdAt: string;
  read: boolean;
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
