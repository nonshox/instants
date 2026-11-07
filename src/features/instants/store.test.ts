import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchFeedPage,
  setInstantLike,
  type FeedInstant,
} from "./client-api";
import { useInstantStore } from "./store";

vi.mock("./client-api", () => ({
  deleteInstant: vi.fn(),
  fetchFeedPage: vi.fn(),
  setInstantLike: vi.fn(),
  uploadInstant: vi.fn(),
}));

const instant: FeedInstant = {
  id: "instant-1",
  username: "friend",
  caption: "",
  likes: 1,
  likedByViewer: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  imageUrl: "/api/instants/instant-1/image",
};

describe("Instant store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useInstantStore.getState().reset();
  });

  it("updates feed likes from the server result and clears pending state", async () => {
    vi.mocked(setInstantLike).mockResolvedValue({
      liked: true,
      likes: 2,
    });
    useInstantStore.setState({ accountId: "account-1", feed: [instant] });

    await useInstantStore.getState().toggleLike(instant, true);

    expect(useInstantStore.getState().feed[0]).toMatchObject({
      likedByViewer: true,
      likes: 2,
    });
    expect(useInstantStore.getState().pendingLikes.has(instant.id)).toBe(false);
  });

  it("retains the feed and reports an error when a like request fails", async () => {
    vi.mocked(setInstantLike).mockRejectedValue(new Error("network"));
    useInstantStore.setState({ accountId: "account-1", feed: [instant] });

    await useInstantStore.getState().toggleLike(instant, true);

    expect(useInstantStore.getState().feed[0]).toEqual(instant);
    expect(useInstantStore.getState().feedError).toBe(
      "The like could not be updated.",
    );
    expect(useInstantStore.getState().pendingLikes.has(instant.id)).toBe(false);
  });

  it("initializes the following feed without opening the local archive", async () => {
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
