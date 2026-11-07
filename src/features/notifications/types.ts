import type { Models } from "node-appwrite";

export const notificationTypes = [
  "follow_request",
  "follow_approved",
  "new_follower",
  "like",
] as const;

export type NotificationType = (typeof notificationTypes)[number];

export type NotificationRow = Models.Row & {
  recipient: string;
  actor: string;
  type: NotificationType;
  instant?: string;
  read: boolean;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  actorUsername: string;
  instantId: string | null;
  createdAt: string;
  read: boolean;
};
