import { create, type StoreApi } from "zustand";
import {
  createLocalInstant,
  deleteArchivedInstant,
  listArchivedInstants,
  saveArchivedInstant,
  type ArchivedInstant,
} from "./archive";
import {
  deleteInstant as deleteInstantRequest,
  fetchFeedPage,
  setInstantLike,
  updateInstantCaption,
  uploadInstant,
  type FeedInstant,
} from "./client-api";
import { getApiErrorMessage } from "../../lib/api-client";

type InstantState = {
  accountId: string | null;
  archiveInitialized: boolean;
  archiveInitializing: boolean;
  feedInitialized: boolean;
  feedInitializing: boolean;
  archive: ArchivedInstant[];
  feed: FeedInstant[];
  archiveLoading: boolean;
  feedLoading: boolean;
  loadingMore: boolean;
  uploading: boolean;
  pendingDeleteId: string;
  pendingCaptionId: string;
  pendingLikes: Set<string>;
  nextCursor: string | null;
  hasMore: boolean;
  archiveError: string;
  feedError: string;
  uploadMessage: string;
  setAccountId: (accountId: string) => void;
  initialize: (accountId: string) => Promise<void>;
  initializeArchive: (accountId: string) => Promise<void>;
  initializeFeed: (accountId: string) => Promise<void>;
  refreshArchive: () => Promise<void>;
  loadFeedPage: (cursor: string | null, append: boolean) => Promise<void>;
  upload: (file: File, caption: string) => Promise<ArchivedInstant | null>;
  retryUpload: (instant: ArchivedInstant) => Promise<void>;
  updateCaption: (instant: ArchivedInstant, caption: string) => Promise<boolean>;
  toggleLike: (instant: FeedInstant, liked: boolean) => Promise<void>;
  delete: (instant: ArchivedInstant) => Promise<void>;
  clearUploadMessage: () => void;
  reset: () => void;
};

const initialState = {
  accountId: null,
  archiveInitialized: false,
  archiveInitializing: false,
  feedInitialized: false,
  feedInitializing: false,
  archive: [] as ArchivedInstant[],
  feed: [] as FeedInstant[],
  archiveLoading: true,
  feedLoading: true,
  loadingMore: false,
  uploading: false,
  pendingDeleteId: "",
  pendingCaptionId: "",
  pendingLikes: new Set<string>(),
  nextCursor: null,
  hasMore: false,
  archiveError: "",
  feedError: "",
  uploadMessage: "",
};

export const useInstantStore = create<InstantState>((set, get) => ({
  ...initialState,
  setAccountId: (accountId) => {
    if (get().accountId !== accountId) {
      set({ ...initialState, accountId });
    }
  },
  initialize: async (accountId) =>
    Promise.all([
      get().initializeArchive(accountId),
      get().initializeFeed(accountId),
    ]).then(() => undefined),
  initializeArchive: async (accountId) => {
    get().setAccountId(accountId);
    if (get().archiveInitialized || get().archiveInitializing) return;
    set({ archiveInitializing: true });
    await loadArchive(accountId, set);
    set((state) =>
      state.accountId === accountId
        ? { archiveInitialized: true, archiveInitializing: false }
        : {},
    );
  },
  initializeFeed: async (accountId) => {
    get().setAccountId(accountId);
    if (get().feedInitialized || get().feedInitializing) return;
    set({ feedInitializing: true });
    await loadFeed(null, false, set, accountId);
    set((state) =>
      state.accountId === accountId
        ? { feedInitialized: true, feedInitializing: false }
        : {},
    );
  },
  refreshArchive: async () => {
    const accountId = get().accountId;
    if (!accountId) return;
    set({ archiveLoading: true, archiveError: "" });
    await loadArchive(accountId, set);
  },
  loadFeedPage: async (cursor, append) =>
    loadFeed(cursor, append, set, get().accountId),
  upload: async (file, caption) => {
    const accountId = get().accountId;
    if (!accountId) return null;

    set({ uploading: true, uploadMessage: "", archiveError: "" });
    const localInstant = createLocalInstant(
      accountId,
      file,
      caption.trim(),
      file.lastModified || Date.now(),
      file.type,
    );
    const pendingInstant = { ...localInstant, syncState: "uploading" as const };

    try {
      await saveArchivedInstant(pendingInstant);
      set((state) => ({ archive: [pendingInstant, ...state.archive] }));
    } catch {
      set({
        archiveError:
          "The photo was not uploaded because it could not be saved to your local archive.",
        uploading: false,
      });
      return null;
    }

    try {
      const serverId = await uploadInstant(
        pendingInstant.localId,
        pendingInstant.image,
        pendingInstant.mimeType,
        pendingInstant.caption,
      );
      const savedInstant = {
        ...pendingInstant,
        serverId,
        syncState: "uploaded" as const,
      };
      await saveArchivedInstant(savedInstant);
      set((state) => ({
        archive: state.archive.map((item) =>
          item.localId === savedInstant.localId ? savedInstant : item,
        ),
        uploadMessage: "Instant shared and saved to your local archive.",
      }));
      await loadFeed(null, false, set, accountId);
      return savedInstant;
    } catch (cause) {
      const failedInstant = { ...pendingInstant, syncState: "failed" as const };
      try {
        await saveArchivedInstant(failedInstant);
        set((state) => ({
          archive: state.archive.map((item) =>
            item.localId === failedInstant.localId ? failedInstant : item,
          ),
        }));
      } catch {
        set({
          archiveError:
            "Sharing and saving the photo status failed. The local photo may still be archived.",
        });
      }
      set({
        uploadMessage: getApiErrorMessage(
          cause,
          "Sharing failed; your local copy is safe.",
        ),
      });
      return failedInstant;
    } finally {
      set({ uploading: false });
    }
  },
  retryUpload: async (instant) => {
    set({ pendingDeleteId: instant.localId, uploadMessage: "" });
    try {
      await saveArchivedInstant({ ...instant, syncState: "uploading" });
      const serverId = await uploadInstant(
        instant.localId,
        instant.image,
        instant.mimeType,
        instant.caption,
      );
      await saveArchivedInstant({
        ...instant,
        serverId,
        syncState: "uploaded",
      });
      set({ uploadMessage: "Instant shared from your local archive." });
      await get().refreshArchive();
      await loadFeed(null, false, set, get().accountId);
    } catch (cause) {
      await saveArchivedInstant({ ...instant, syncState: "failed" });
      await get().refreshArchive();
      set({
        uploadMessage: getApiErrorMessage(
          cause,
          "Sharing failed; your local copy is safe.",
        ),
      });
    } finally {
      set({ pendingDeleteId: "" });
    }
  },
  updateCaption: async (instant, caption) => {
    const next = caption.trim().replace(/\s+/g, " ");
    if (next.length > 60 || /[\r\n]/.test(next)) {
      set({ archiveError: "Keep the caption to one short line." });
      return false;
    }

    set({ pendingCaptionId: instant.localId, archiveError: "" });
    const previous = instant;
    const optimistic = { ...instant, caption: next };
    try {
      await saveArchivedInstant(optimistic);
      set((state) => ({
        archive: state.archive.map((item) =>
          item.localId === instant.localId ? optimistic : item,
        ),
      }));
      if (instant.serverId) {
        await updateInstantCaption(instant.serverId, next);
      }
      return true;
    } catch (cause) {
      await saveArchivedInstant(previous).catch(() => undefined);
      set((state) => ({
        archive: state.archive.map((item) =>
          item.localId === instant.localId ? previous : item,
        ),
        archiveError: getApiErrorMessage(
          cause,
          "The caption could not be saved.",
        ),
      }));
      return false;
    } finally {
      set({ pendingCaptionId: "" });
    }
  },
  toggleLike: async (instant, liked) => {
    // Optimistic: update the UI immediately, roll back on failure.
    set((state) => ({
      pendingLikes: new Set(state.pendingLikes).add(instant.id),
      feed: state.feed.map((item) =>
        item.id === instant.id
          ? {
              ...item,
              likedByViewer: liked,
              likes: Math.max(0, item.likes + (liked ? 1 : -1)),
            }
          : item,
      ),
    }));
    try {
      const result = await setInstantLike(instant.id, liked);
      set((state) => ({
        feed: state.feed.map((item) =>
          item.id === instant.id
            ? {
                ...item,
                likedByViewer: result.liked,
                likes: result.likes,
              }
            : item,
        ),
      }));
    } catch (cause) {
      set((state) => ({
        feed: state.feed.map((item) =>
          item.id === instant.id ? { ...item, ...instant } : item,
        ),
        feedError: getApiErrorMessage(
          cause,
          "The like could not be updated.",
        ),
      }));
    } finally {
      set((state) => {
        const pendingLikes = new Set(state.pendingLikes);
        pendingLikes.delete(instant.id);
        return { pendingLikes };
      });
    }
  },
  delete: async (instant) => {
    set({ pendingDeleteId: instant.localId, archiveError: "" });
    try {
      if (instant.serverId) {
        await deleteInstantRequest(instant.serverId);
      }
      await deleteArchivedInstant(instant.localId);
      set((state) => ({
        archive: state.archive.filter(
          (item) => item.localId !== instant.localId,
        ),
        feed: instant.serverId
          ? state.feed.filter((item) => item.id !== instant.serverId)
          : state.feed,
        uploadMessage: "Instant permanently deleted.",
      }));
    } catch (cause) {
      set({
        archiveError: getApiErrorMessage(
          cause,
          "The Instant could not be fully deleted. Your local copy was kept.",
        ),
      });
    } finally {
      set({ pendingDeleteId: "" });
    }
  },
  clearUploadMessage: () => set({ uploadMessage: "" }),
  reset: () => set(initialState),
}));

async function loadArchive(
  accountId: string,
  set: StoreApi<InstantState>["setState"],
): Promise<void> {
  set({ archiveLoading: true, archiveError: "" });
  try {
    const items = await listArchivedInstants(accountId);
    const recovered = items.map((item) =>
      item.syncState === "uploading"
        ? { ...item, syncState: "failed" as const }
        : item,
    );
    await Promise.all(
      recovered
        .filter((item) => item.syncState === "failed")
        .map(saveArchivedInstant),
    );
    set((state) =>
      state.accountId === accountId
        ? { archive: recovered, archiveLoading: false }
        : {},
    );
  } catch {
    set((state) =>
      state.accountId === accountId
        ? {
            archiveError: "Your local archive could not be opened.",
            archiveLoading: false,
          }
        : {},
    );
  }
}

async function loadFeed(
  cursor: string | null,
  append: boolean,
  set: StoreApi<InstantState>["setState"],
  accountId: string | null,
): Promise<void> {
  if (!accountId) return;
  set(append
    ? { loadingMore: true, feedError: "" }
    : { feedLoading: true, feedError: "" });
  try {
    const data = await fetchFeedPage(cursor);
    set((state) => {
      if (state.accountId !== accountId) return {};
      return {
        feed: append
          ? [
              ...state.feed,
              ...data.items.filter(
                (item) =>
                  !state.feed.some((existing) => existing.id === item.id),
              ),
            ]
          : data.items,
        nextCursor: data.nextCursor,
        hasMore: data.hasMore,
        feedError: "",
        feedLoading: false,
        loadingMore: false,
      };
    });
  } catch (cause) {
    set((state) =>
      state.accountId === accountId
        ? {
            feedError: getApiErrorMessage(
              cause,
              "Your feed could not be loaded.",
            ),
            feedLoading: false,
            loadingMore: false,
          }
        : {},
    );
  }
}
