import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchFeedPage,
  setInstantReaction,
  type FeedInstant,
} from "./client-api";
import { useInstantStore } from "./store";

vi.mock("./client-api", () => ({
  deleteInstant: vi.fn(),
  fetchFeedPage: vi.fn(),
  setInstantReaction: vi.fn(),
  uploadInstant: vi.fn(),
}));

const instant: FeedInstant = {
  id: "instant-1",
  ownerId: "owner-1",
  username: "friend",
  avatar: "",
  caption: "",
  likes: 1,
  reaction: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  imageUrl: "/api/instants/instant-1/image",
};

describe("Instant store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInstantStore.getState().reset();
  });

  it("updates feed reactions from the server result and clears pending state", async () => {
    vi.mocked(setInstantReaction).mockResolvedValue({
      reaction: "🔥",
      reactions: 2,
    });
    useInstantStore.setState({ accountId: "account-1", feed: [instant] });

    await useInstantStore.getState().setReaction(instant, "🔥");

    expect(useInstantStore.getState().feed[0]).toMatchObject({
      reaction: "🔥",
      likes: 2,
    });
    expect(useInstantStore.getState().pendingLikes.has(instant.id)).toBe(false);
  });

  it("rolls back to the previous reaction when the request fails", async () => {
    vi.mocked(setInstantReaction).mockRejectedValue(new Error("network"));
    useInstantStore.setState({ accountId: "account-1", feed: [instant] });

    await useInstantStore.getState().setReaction(instant, "🔥");

    expect(useInstantStore.getState().feed[0]).toEqual(instant);
    expect(useInstantStore.getState().feedError).toBe(
      "The reaction could not be updated.",
    );
    expect(useInstantStore.getState().pendingLikes.has(instant.id)).toBe(false);
  });

  it("initializes the links feed without opening the local archive", async () => {
    vi.mocked(fetchFeedPage).mockResolvedValue({
      items: [instant],
      nextCursor: null,
      hasMore: false,
    });

    await useInstantStore.getState().initializeFeed("account-1");

    expect(useInstantStore.getState().feed).toEqual([instant]);
    expect(useInstantStore.getState().feedInitialized).toBe(true);
    expect(useInstantStore.getState().archiveInitialized).toBe(false);
  });
});
