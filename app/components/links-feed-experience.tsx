
"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useInstantStore } from "@/src/features/instants/store";
import { formatInstantDate } from "@/src/features/instants/format-date";

export function LinksFeedExperience({
  accountId,
}: {
  accountId: string;
}) {
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

  const [doubleTapInstant, setDoubleTapInstant] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void initializeFeed(accountId);
  }, [accountId, initializeFeed]);

  async function handleDoubleTap(
    instant: (typeof feed)[number],
  ) {
    setDoubleTapInstant(instant.id);
    window.setTimeout(() => setDoubleTapInstant(null), 650);

    if (!instant.likedByViewer && !pendingLikes.has(instant.id)) {
      await updateLike(instant, true);
    }
  }

  return (
    <section className="mx-auto w-full max-w-[470px]">
      {error && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-destructive">{error}</p>
          <Button
            aria-label="Retry loading feed"
            disabled={loading}
            onClick={() => void loadFeedPage(null, false)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <RefreshCw aria-hidden="true" size={16} />
          </Button>
        </div>
      )}

      {loading && feed.length === 0 ? (
        <div className="space-y-8" role="status">
          {[1, 2].map((item) => (
            <div className="animate-pulse" key={item}>
              <div className="mb-3 flex items-center gap-3">
                <div className="size-9 rounded-full bg-muted" />
                <div className="h-3 w-24 rounded-full bg-muted" />
              </div>
              <div className="aspect-square rounded-xl bg-muted" />
              <div className="mt-4 h-3 w-16 rounded-full bg-muted" />
            </div>
          ))}
          <span className="sr-only">Loading Instants</span>
        </div>
      ) : feed.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <div className="mb-5 grid size-14 place-items-center rounded-full border border-border">
            <Heart className="text-muted-foreground" size={23} />
          </div>
          <p className="text-sm font-medium">Your feed is quiet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Link with people to see their Instants here.
          </p>
          <Button
            className="mt-5 rounded-full"
            nativeButton={false}
            render={<Link href="/connections" />}
            size="sm"
            variant="outline"
          >
            Find people
          </Button>
        </div>
      ) : (
        <div className="space-y-8 sm:space-y-10">
          {feed.map((instant) => {
            const liked = instant.likedByViewer;
            const isPending = pendingLikes.has(instant.id);

            return (
              <article
                className="min-w-0"
                key={instant.id}
              >
                {/* Account */}
                <header className="mb-3 flex items-center gap-3 px-1">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase">
                    {instant.username.slice(0, 1)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      @{instant.username}
                    </p>
                    <time
                      className="mt-0.5 block text-xs text-muted-foreground"
                      dateTime={instant.createdAt}
                    >
                      {formatInstantDate(instant.createdAt)}
                    </time>
                  </div>
                </header>

                {/* Instant image */}
                <div
                  className="group relative isolate aspect-square overflow-hidden rounded-xl bg-muted sm:rounded-2xl"
                  onDoubleClick={() => void handleDoubleTap(instant)}
                >
                  <Image
                    alt={`Instant shared by @${instant.username}`}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.015]"
                    fill
                    sizes="(max-width: 500px) 100vw, 470px"
                    src={instant.imageUrl}
                    unoptimized
                  />

                  {doubleTapInstant === instant.id && (
                    <div
                      className="pointer-events-none absolute inset-0 grid place-items-center"
                      aria-hidden="true"
                    >
                      <Heart
                        className="animate-in zoom-in-50 fill-white text-white drop-shadow-xl duration-300"
                        size={76}
                        strokeWidth={1.5}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 px-1 pt-3">
                  <button
                    aria-label={liked ? "Unlike Instant" : "Like Instant"}
                    aria-pressed={liked}
                    className={`inline-flex size-9 items-center justify-center rounded-full transition active:scale-90 disabled:opacity-50 ${
                      liked
                        ? "text-rose-500"
                        : "text-foreground hover:text-rose-500"
                    }`}
                    disabled={isPending}
                    onClick={() => void updateLike(instant, !liked)}
                    type="button"
                  >
                    <Heart
                      fill={liked ? "currentColor" : "none"}
                      size={23}
                      strokeWidth={1.8}
                    />
                  </button>

                  <span className="text-sm font-semibold tabular-nums">
                    {instant.likes.toLocaleString()}
                    <span className="ml-1 font-normal text-muted-foreground">
                      {instant.likes === 1 ? "like" : "likes"}
                    </span>
                  </span>
                </div>

                {/* Caption */}
                {instant.caption && (
                  <p className="mt-1 px-1 text-sm leading-relaxed">
                    <span className="mr-1.5 font-semibold">
                      @{instant.username}
                    </span>
                    <span className="whitespace-pre-wrap">
                      {instant.caption}
                    </span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      {hasMore && feed.length > 0 && (
        <div className="flex justify-center py-10">
          <Button
            className="min-w-36 rounded-full"
            disabled={loadingMore}
            onClick={() => void loadFeedPage(nextCursor, true)}
            type="button"
            variant="outline"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </section>
  );
}
