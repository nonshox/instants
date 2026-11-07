import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchNotifications,
  markNotificationRead,
} from "./client-api";
import { useNotificationStore } from "./store";

vi.mock("./client-api", () => ({
  fetchNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const firstNotification = {
  id: "notification-1",
  type: "like" as const,
  actorUsername: "friend",
  instantId: "instant-1",
  createdAt: "2026-01-01T00:00:00.000Z",
  read: false,
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
        items: [firstNotification],
        nextCursor: null,
        unreadCount: 1,
      });

    const store = useNotificationStore.getState();
    await store.load();
    await useNotificationStore.getState().loadMore();

    expect(useNotificationStore.getState().items).toHaveLength(1);
    expect(useNotificationStore.getState().cursor).toBeNull();

    await useNotificationStore.getState().markRead(firstNotification);
    expect(markNotificationRead).toHaveBeenCalledWith(firstNotification.id);
    expect(useNotificationStore.getState().items[0].read).toBe(true);
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
