import { create } from "zustand";
import {
  fetchNotifications,
  markNotificationRead,
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
      set((state) => ({
        items: [
          ...state.items,
          ...data.items.filter(
            (item) => !state.items.some((existing) => existing.id === item.id),
          ),
        ],
        cursor: data.nextCursor,
        unreadCount: data.unreadCount,
        loadingMore: false,
      }));
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
    set((state) => ({
      pendingIds: new Set(state.pendingIds).add(item.id),
      error: "",
    }));
    try {
      await markNotificationRead(item.id);
      set((state) => ({
        items: state.items.map((entry) =>
          entry.id === item.id ? { ...entry, read: true } : entry,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
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
        pendingIds.delete(item.id);
        return { pendingIds };
      });
    }
  },
  reset: () => set(initialState),
}));
