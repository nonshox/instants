"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useInstantStore } from "@/src/features/instants/store";
import { formatInstantDate } from "@/src/features/instants/format-date";

export function FollowingFeedExperience({ accountId }: { accountId: string }) {
  const feed = useInstantStore((state) => state.feed);
  const loading = useInstantStore((state) => state.feedLoading);
  const loadingMore = useInstantStore((state) => state.loadingMore);
  const pendingLikes = useInstantStore((state) => state.pendingLikes);
  const nextCursor = useInstantStore((state) => state.nextCursor);
  const hasMore = useInstantStore((state) => state.hasMore);
  const error = useInstantStore((state) => state.feedError);
  const initializeFeed = useInstantStore((state) => state.initializeFeed);
  const loadFeedPage = useInstantStore((state) => state.loadFeedPage);
  const updateLike = useInstantStore((state) => state.toggleLike);

  useEffect(() => {
    void initializeFeed(accountId);
  }, [accountId, initializeFeed]);

  return (
    <section aria-labelledby="feed-title">
      <header className="mb-5 border-b pb-4">
        <p className="mb-1 text-sm text-muted-foreground">Your feed</p>
        <h1 className="text-2xl font-semibold tracking-tight" id="feed-title">
          Following
        </h1>
      </header>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            aria-label="Retry loading feed"
            disabled={loading}
            onClick={() => void loadFeedPage(null, false)}
            size="icon"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
      )}

      {loading ? (
        <p className="py-6 text-sm text-muted-foreground" role="status">
          Loading your feed...
        </p>
      ) : feed.length === 0 ? (
        <div className="grid justify-items-start gap-2 py-6">
          <p className="text-sm text-muted-foreground">
            No Instants from people you follow yet.
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/connections" />}
            variant="outline"
          >
            Find people
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {feed.map((instant) => (
            <article className="overflow-hidden rounded-lg border" key={instant.id}>
              <div className="relative aspect-[4/3] bg-muted">
                <Image
                  alt={`Instant shared by @${instant.username}`}
                  className="object-cover"
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  src={instant.imageUrl}
                  unoptimized
                />
              </div>
              <div className="p-3">
                <p className="m-0 text-sm font-semibold">@{instant.username}</p>
                {instant.caption && (
                  <p className="mb-0 mt-2 text-sm text-muted-foreground">
                    {instant.caption}
                  </p>
                )}
                <time
                  className="mt-2 block text-xs text-muted-foreground"
                  dateTime={instant.createdAt}
                >
                  {formatInstantDate(instant.createdAt)}
                </time>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    aria-label={instant.likedByViewer ? "Unlike Instant" : "Like Instant"}
                    aria-pressed={instant.likedByViewer}
                    className="inline-flex items-center gap-1 rounded-md p-1 text-foreground disabled:opacity-50"
                    disabled={pendingLikes.has(instant.id)}
                    onClick={() => void updateLike(instant, !instant.likedByViewer)}
                    type="button"
                  >
                    <Heart
                      aria-hidden="true"
                      fill={instant.likedByViewer ? "currentColor" : "none"}
                      size={16}
                    />
                    <span className="text-xs">{instant.likes}</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {hasMore && (
        <Button
          className="mt-5 w-full"
          disabled={loadingMore}
          onClick={() => void loadFeedPage(nextCursor, true)}
          type="button"
          variant="outline"
        >
          {loadingMore ? "Loading..." : "Load more"}
        </Button>
      )}
    </section>
  );
}
