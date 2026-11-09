import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchNotifications,
  markNotificationsRead,
} from "./client-api";
import { useNotificationStore } from "./store";

vi.mock("./client-api", () => ({
  fetchNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
}));

const firstNotification = {
  id: "notification-1",
  type: "like" as const,
  actorId: "actor-1",
  actorUsername: "friend",
  actorAvatar: "",
  instantId: "instant-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  read: false,
  count: 1,
  ids: ["notification-1"],
};

const secondNotification = {
  ...firstNotification,
  id: "notification-2",
  actorId: "actor-2",
};

describe("notification store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNotificationStore.getState().reset();
  });

  it("loads pages, deduplicates items, and updates unread state", async () => {
    vi.mocked(fetchNotifications)
      .mockResolvedValueOnce({
        items: [firstNotification],
        nextCursor: "next",
        unreadCount: 1,
      })
      .mockResolvedValueOnce({
        items: [secondNotification],
        nextCursor: null,
        unreadCount: 1,
      });

    const store = useNotificationStore.getState();
    await store.load();
    await useNotificationStore.getState().loadMore();

    expect(useNotificationStore.getState().items).toHaveLength(2);
    expect(useNotificationStore.getState().cursor).toBeNull();

    await useNotificationStore.getState().markRead(firstNotification);
    expect(markNotificationsRead).toHaveBeenCalledWith(["notification-1"]);
    expect(useNotificationStore.getState().items[0].read).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(1);
  });

  it("marks every row in a grouped reaction as read with one call", async () => {
    vi.mocked(fetchNotifications).mockResolvedValueOnce({
      items: [
        {
          ...firstNotification,
          count: 3,
          ids: ["notification-1", "notification-2", "notification-3"],
        },
      ],
      nextCursor: null,
      unreadCount: 3,
    });

    await useNotificationStore.getState().load();
    await useNotificationStore.getState().markRead(
      useNotificationStore.getState().items[0],
    );

    expect(markNotificationsRead).toHaveBeenCalledWith([
      "notification-1",
      "notification-2",
      "notification-3",
    ]);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });

  it("allows retry after a load error", async () => {
    vi.mocked(fetchNotifications)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        items: [],
        nextCursor: null,
        unreadCount: 0,
      });

    await useNotificationStore.getState().load();
    expect(useNotificationStore.getState().error).toBe(
      "Notifications could not be loaded.",
    );

    await useNotificationStore.getState().load();
    expect(useNotificationStore.getState().loaded).toBe(true);
    expect(fetchNotifications).toHaveBeenCalledTimes(2);
  });
});
