import { create } from "zustand";
import {
  fetchNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "./client-api";
import { getApiErrorMessage } from "../../lib/api-client";

type NotificationState = {
  items: NotificationItem[];
  unreadCount: number;
  cursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  loaded: boolean;
  started: boolean;
  pendingIds: Set<string>;
  error: string;
  load: (refresh?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (item: NotificationItem) => Promise<void>;
  markAllRead: () => Promise<void>;
  reset: () => void;
};

const initialState = {
  items: [] as NotificationItem[],
  unreadCount: 0,
  cursor: null,
  loading: true,
  loadingMore: false,
  loaded: false,
  started: false,
  pendingIds: new Set<string>(),
  error: "",
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  ...initialState,
  load: async (refresh = false) => {
    if (get().started || (get().loaded && !refresh)) return;
    set({ started: true });
    set({ loading: true, error: "" });
    try {
      const data = await fetchNotifications(null);
      set({
        items: data.items,
        unreadCount: data.unreadCount,
        cursor: data.nextCursor,
        loading: false,
        loaded: true,
        started: false,
      });
    } catch (cause) {
      set({
        error: getApiErrorMessage(
          cause,
          "Notifications could not be loaded.",
        ),
        loading: false,
        loaded: false,
        started: false,
      });
    }
  },
  loadMore: async () => {
    const cursor = get().cursor;
    if (!cursor || get().loadingMore || get().loading) return;
    set({ loadingMore: true, error: "" });
    try {
      const data = await fetchNotifications(cursor);
      set((state) => {
        const merged = [
          ...state.items,
          ...data.items.filter(
            (item) => !state.items.some((existing) => existing.id === item.id),
          ),
        ];
        return {
          items: merged,
          cursor: data.nextCursor,
          // Sum across every page we've loaded, not just the latest one.
          unreadCount: merged.reduce(
            (sum, item) => sum + (item.read ? 0 : item.count),
            0,
          ),
          loadingMore: false,
        };
      });
    } catch (cause) {
      set({
        error: getApiErrorMessage(
          cause,
          "More notifications could not be loaded.",
        ),
        loadingMore: false,
      });
    }
  },
  markRead: async (item) => {
    if (item.read || get().pendingIds.has(item.id)) return;
    const ids = item.ids ?? [item.id];
    set((state) => ({
      pendingIds: new Set([...state.pendingIds, ...ids]),
      error: "",
    }));
    try {
      await markNotificationsRead(ids);
      set((state) => ({
        items: state.items.map((entry) =>
          entry.id === item.id ? { ...entry, read: true } : entry,
        ),
        unreadCount: Math.max(0, state.unreadCount - item.count),
      }));
    } catch (cause) {
      set({
        error: getApiErrorMessage(
          cause,
          "This notification could not be marked as read.",
        ),
      });
    } finally {
      set((state) => {
        const pendingIds = new Set(state.pendingIds);
        for (const id of ids) pendingIds.delete(id);
        return { pendingIds };
      });
    }
  },
  markAllRead: async () => {
    const unreadIds = [
      ...new Set(
        get()
          .items.filter((item) => !item.read)
          .flatMap((item) => item.ids ?? [item.id]),
      ),
    ];
    if (unreadIds.length === 0) return;
    set({ pendingIds: new Set(unreadIds), error: "" });
    try {
      for (let start = 0; start < unreadIds.length; start += 50) {
        await markNotificationsRead(unreadIds.slice(start, start + 50));
      }
      set((state) => ({
        items: state.items.map((entry) => ({ ...entry, read: true })),
        unreadCount: 0,
        pendingIds: new Set<string>(),
      }));
    } catch (cause) {
      set({
        error: getApiErrorMessage(
          cause,
          "Notifications could not be marked as read.",
        ),
        pendingIds: new Set<string>(),
      });
    }
  },
  reset: () => set(initialState),
}));
