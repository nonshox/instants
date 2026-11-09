
"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Check,
  Heart,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";

import { Button } from "@/components/ui/button";
import { recordInstantView } from "@/src/features/instants/client-api";
import { useInstantStore } from "@/src/features/instants/store";
import { formatRelativeTime } from "@/src/features/instants/format-date";
import type { FeedInstant } from "@/src/features/instants/client-api";
import { UserAvatar } from "@/app/components/user-avatar";

const VISIBLE_CARDS = 3;
const DRAG_COMMIT_DISTANCE = 165;
const DRAG_COMMIT_SPEED = 650;
const CARD_SHADOW =
  "shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)] ring-1 ring-border/70";

type ExitVector = {
  /** How far off-screen the card flies on exit. */
  x: number;
  y: number;
  rotate: number;
};

// The row is 3 ordered main reactions + 2 fixed "wild card" picks sampled
// per viewer (hash-seeded so it is hydration-safe and unique per account).
const MAIN_REACTIONS = ["❤️", "🔥", "😍"] as const;
const RANDOM_POOL = ["👏", "🙌", "🤩", "😄", "🎉", "💪", "🥹", "✨"];

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickTwoRandom(seed: number): [string, string] {
  const pool = [...RANDOM_POOL];
  const first = pool.splice(seed % pool.length, 1)[0];
  const second = pool.splice(Math.floor(seed / pool.length) % pool.length, 1)[0];
  return [first, second];
}

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
  const updateLike = useInstantStore((state) => state.setReaction);

  // How many cards have been dealt past the front of the deck.
  const [dismissedCount, setDismissedCount] = useState(0);
  // Where the top card flies off to, consumed by the exit animation.
  const [exitVector, setExitVector] = useState<ExitVector>({
    x: 620,
    y: -40,
    rotate: 16,
  });
  // Cards mid-flight after being dealt away. They must not intercept
  // taps/focus while AnimatePresence is animating them out.
  const [exitingIds, setExitingIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [likeBurst, setLikeBurst] = useState<{
    id: number;
    emoji: string;
  } | null>(null);
  const burstTimer = useRef<number | null>(null);
  const dealDirection = useRef(1);

  useEffect(() => {
    void initializeFeed(accountId);
  }, [accountId, initializeFeed]);

  // Deterministic per viewer — hydration-safe and stable across reloads.
  const randomPicks = pickTwoRandom(hashString(accountId));

  useEffect(
    () => () => {
      if (burstTimer.current) window.clearTimeout(burstTimer.current);
    },
    [],
  );

  const total = feed.length;
  const topIndex = Math.min(dismissedCount, total);
  const topInstant = topIndex < total ? feed[topIndex] : null;
  const visible = feed.slice(topIndex, topIndex + VISIBLE_CARDS);

  // Alternating fly-off direction for click/keyboard deals.
  const dealVector = (): ExitVector => {
    dealDirection.current = -dealDirection.current || 1;
    const sign = dealDirection.current;
    return { x: sign * 620, y: -40, rotate: sign * 16 };
  };

  const dismissTop = useCallback(
    (vector: ExitVector) => {
      const current = topIndex < total ? feed[topIndex] : null;
      if (!current) return;
      // Mark as seen — dealt Instants leave the feed for good.
      void recordInstantView(current.id).catch(() => {
        // A missed view marker only means it may reappear on next visit.
      });
      setExitVector(vector);
      setExitingIds((ids) => new Set(ids).add(current.id));
      setDismissedCount((count) => count + 1);
      // Prefetch the next page when one card from the end is left.
      if (topIndex + 1 >= total - 1 && hasMore && !loadingMore) {
        void loadFeedPage(nextCursor, true);
      }
    },
    [feed, hasMore, loadFeedPage, loadingMore, nextCursor, topIndex, total],
  );

  const reactTo = useCallback(
    (emoji: string) => {
      if (!topInstant || pendingLikes.has(topInstant.id)) return;
      const next = topInstant.reaction === emoji ? null : emoji;
      // A reaction deals the photo away — the image disappears for good.
      if (next !== null) {
        setLikeBurst((burst) => ({ id: (burst?.id ?? 0) + 1, emoji }));
        if (burstTimer.current) window.clearTimeout(burstTimer.current);
        burstTimer.current = window.setTimeout(() => setLikeBurst(null), 700);
      }
      void updateLike(topInstant, next);
      dismissTop(dealVector());
    },
    [pendingLikes, topInstant, updateLike, dismissTop],
  );

  // Keyboard: → deals the next image. There is no way back to a seen Instant.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight" && topInstant) {
        event.preventDefault();
        dismissTop(dealVector());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismissTop, topInstant]);

  const deckExhausted = total > 0 && topIndex >= total;
  const chosenReaction = topInstant ? topInstant.reaction : null;

  return (
    <section
      aria-label="Instants feed"
      className="mx-auto flex h-full min-h-[320px] w-full max-w-[560px] select-none flex-col"
    >
      {error && (
        <div
          className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.04] px-3 py-2"
          role="alert"
        >
          <p className="min-w-0 flex-1 text-xs text-destructive">{error}</p>
          <button
            aria-label="Retry loading feed"
            className="grid size-7 shrink-0 place-items-center rounded-full text-destructive outline-none transition hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            disabled={loading}
            onClick={() => void loadFeedPage(null, false)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={14} />
          </button>
        </div>
      )}

      {/* Stage — no panning anywhere in the deck, so the page never scrolls */}
      <div
        aria-label="Photo deck"
        className="relative mt-2 min-h-0 flex-1 [touch-action:none]"
      >
        {loading && total === 0 ? (
          <DeckSkeleton />
        ) : total === 0 ? (
          <QuietFeed />
        ) : deckExhausted ? (
          <DeckComplete
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={() => void loadFeedPage(nextCursor, true)}
          />
        ) : (
          <>
            <AnimatePresence initial={false}>
              {visible
                .slice()
                .reverse()
                .map((instant, reversedIndex) => {
                  const position = visible.length - 1 - reversedIndex; // 0 = front
                  return (
                    <DeckCard
                      exitVector={exitVector}
                      exiting={exitingIds.has(instant.id)}
                      instant={instant}
                      key={instant.id}
                      onDismiss={dismissTop}
                      position={position}
                      topIndex={topIndex}
                      total={total}
                    />
                  );
                })}
            </AnimatePresence>

            {/* Your reaction bursts on top — the emoji you picked, big */}
            {likeBurst && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 z-30 grid place-items-center"
                key={likeBurst.id}
              >
                <span className="animate-in zoom-in-50 text-8xl drop-shadow-[0_2px_16px_rgba(0,0,0,0.45)] duration-300">
                  {likeBurst.emoji}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Details below the image */}
      {topInstant && !loading && (
        <div className="flex shrink-0 flex-col items-center gap-1 pb-5 pt-1">
          {topInstant.caption && (
            <p
              className="max-w-[46ch] truncate px-4 text-center text-[11px] text-muted-foreground"
              title={topInstant.caption}
            >
              {topInstant.caption}
            </p>
          )}
          <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <UserAvatar
              avatar={topInstant.avatar}
              size={22}
              userId={topInstant.ownerId}
              username={topInstant.username}
            />
            <span className="font-semibold">@{topInstant.username}</span>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <time
              className="text-[11px] font-medium text-muted-foreground"
              dateTime={topInstant.createdAt}
            >
              {formatRelativeTime(topInstant.createdAt)}
            </time>
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {Math.min(topIndex + 1, total)}/{total}
            </span>
          </div>

          {/* Reactions — line 1: ordered main trio, line 2: 2 random picks */}
          <div className="mt-0.5 flex flex-col items-center gap-1.5">
            <div
              aria-label="React to this photo"
              className="flex items-center gap-2"
              role="group"
            >
              {MAIN_REACTIONS.map((emoji) => (
                <ReactionButton
                  disabled={pendingLikes.has(topInstant.id)}
                  emoji={emoji}
                  key={emoji}
                  likeCount={emoji === "❤️" ? topInstant.likes : undefined}
                  onPress={reactTo}
                  selected={chosenReaction === emoji}
                />
              ))}
            </div>
            <div
              aria-label="More reactions"
              className="flex items-center gap-2"
              role="group"
            >
              {randomPicks.map((emoji) => (
                <ReactionButton
                  disabled={pendingLikes.has(topInstant.id)}
                  emoji={emoji}
                  key={emoji}
                  onPress={reactTo}
                  selected={chosenReaction === emoji}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ReactionButton({
  disabled,
  emoji,
  likeCount,
  onPress,
  selected,
}: {
  disabled: boolean;
  emoji: string;
  likeCount?: number;
  onPress: (emoji: string) => void;
  selected: boolean;
}) {
  const isHeart = emoji === "❤️";
  const label = isHeart
    ? selected
      ? `Unlike, ${likeCount?.toLocaleString()} likes`
      : `Like, ${likeCount?.toLocaleString()} likes`
    : selected
      ? `Remove your ${emoji} reaction`
      : `React with ${emoji}`;

  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl outline-none transition active:scale-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${
        selected
          ? "border-rose-300 bg-rose-50 shadow-[0_2px_12px_rgba(244,63,94,0.25)] ring-1 ring-rose-300 dark:border-rose-500/40 dark:bg-rose-500/15"
          : "border-border/70 bg-background hover:border-rose-200 hover:bg-rose-50/60 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10"
      }`}
      disabled={disabled}
      onClick={() => onPress(emoji)}
      type="button"
    >
      <span aria-hidden="true">{emoji}</span>
    </button>
  );
}

function DeckCard({
  exitVector,
  exiting,
  instant,
  onDismiss,
  position,
  topIndex,
  total,
}: {
  exitVector: ExitVector;
  exiting: boolean;
  instant: FeedInstant;
  onDismiss: (vector: ExitVector) => void;
  position: number;
  topIndex: number;
  total: number;
}) {
  const isTop = position === 0 && !exiting;
  const reduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imageReady, setImageReady] = useState(false);

  // Cached photos can complete before hydration attaches onLoad — and
  // onLoad is unreliable for some dynamic sources, so poll until it flips.
  useEffect(() => {
    if (imgRef.current?.complete) {
      setImageReady(true);
      return;
    }
    const id = window.setInterval(() => {
      if (imgRef.current?.complete) {
        setImageReady(true);
        window.clearInterval(id);
      }
    }, 120);
    return () => window.clearInterval(id);
  }, []);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  // The farther the image is pushed from center, the smaller it gets.
  const shrink = useTransform([dragX, dragY], (values: number[]) => {
    const [x, y] = values;
    const distance = Math.hypot(x, y);
    return Math.max(0.72, 1 - distance / 1100);
  });

  const handleDragEnd: (info: {
    offset: { x: number; y: number };
    velocity: { x: number; y: number };
  }) => void = (info) => {
    const dx = info.offset.x;
    const dy = info.offset.y;
    const distance = Math.hypot(dx, dy);
    const speed = Math.hypot(info.velocity.x, info.velocity.y);
    // Returned near center — the card stays.
    if (distance < DRAG_COMMIT_DISTANCE && speed < DRAG_COMMIT_SPEED) {
      return;
    }
    if (Math.abs(dx) >= Math.abs(dy)) {
      onDismiss({
        x: Math.sign(dx || 1) * 640,
        y: dy * 0.4,
        rotate: Math.sign(dx || 1) * 17,
      });
    } else {
      onDismiss({
        x: dx * 0.35,
        y: Math.sign(dy || 1) * 720,
        rotate: Math.sign(dy || 1) * 11,
      });
    }
  };

  const handleTap = (event: EventTarget | null, point: { x: number; y: number }) => {
    if (!isTop) return;
    // Only a tap on the image card itself deals — nothing in the margins.
    if (event instanceof Element && cardRef.current?.contains(event)) {
      const rect = cardRef.current?.getBoundingClientRect();
      const middle = rect ? rect.left + rect.width / 2 : 0;
      const side = point.x < middle ? -1 : 1;
      onDismiss({ x: side * 620, y: -40, rotate: side * 16 });
    }
  };

  return (
    <motion.div
      animate={{
        scale: 1 - position * 0.06,
        y: position * -14,
        rotate: position === 0 ? 0 : position % 2 === 1 ? -2.5 : 2.5,
        opacity: 1,
      }}
      aria-hidden={!isTop}
      className="absolute inset-0 grid place-items-center"
      exit={{
        opacity: 0,
        rotate: exitVector.rotate,
        x: exitVector.x,
        y: exitVector.y,
        transition: { duration: 0.28, ease: "easeOut" },
      }}
      initial={false}
      style={{
        zIndex: 20 - position,
        pointerEvents: exiting ? "none" : "auto",
      }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { damping: 30, stiffness: 320, type: "spring" }
      }
    >
      <motion.div
        drag={isTop || undefined}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.45}
        dragMomentum={false}
        onDragEnd={(_event, info) => handleDragEnd(info)}
        onTap={(_event, info) => handleTap(_event.target, info.point)}
        className="grid h-full place-items-center"
        style={{
          x: dragX,
          y: dragY,
          scale: shrink,
          // framer-motion manages touch-action for drag gestures; the stage
          // wrapper above pins touch-action: none for the whole deck.
        }}
      >
        <div
          ref={cardRef}
          aria-label={
            isTop
              ? `Photo by @${instant.username}, ${topIndex + 1} of ${total}. Activate for next image.`
              : undefined
          }
          className={`relative h-full aspect-square max-w-full overflow-hidden rounded-[2rem] bg-muted ${CARD_SHADOW} ${
            isTop ? "cursor-pointer" : ""
          }`}
          onKeyDown={
            isTop
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onDismiss({ x: 620, y: -40, rotate: 16 });
                  }
                }
              : undefined
          }
          role={isTop ? "button" : undefined}
          tabIndex={isTop ? 0 : undefined}
        >
          <Image
            ref={imgRef}
            alt={`Instant shared by @${instant.username}`}
            className={`pointer-events-none object-cover transition-opacity duration-500 ${
              imageReady ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
            fill
            loading={isTop ? "eager" : "lazy"}
            onLoad={() => setImageReady(true)}
            preload={isTop}
            sizes="(max-width: 640px) 100vw, 560px"
            src={instant.imageUrl}
            unoptimized
          />
          {/* Hold a pulsing placeholder in-card until the photo has faded in —
              never an empty box. */}
          {!imageReady && (
            <div
              aria-hidden="true"
              className="absolute inset-0 animate-pulse bg-muted"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function DeckSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading feed"
      className="absolute inset-0 grid place-items-center"
    >
      {/* Exact match of the card geometry — no layout shift when it loads */}
      <div
        className={`h-full aspect-square max-w-full animate-pulse rounded-[2rem] bg-muted/60 ${CARD_SHADOW}`}
      />
    </div>
  );
}

function QuietFeed() {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="flex flex-col items-center">
        <div className="mb-5 grid size-14 place-items-center rounded-full border border-border">
          <Heart
            aria-hidden="true"
            className="text-muted-foreground"
            size={23}
          />
        </div>
        <p className="text-sm font-medium">Your feed is quiet.</p>
        <p className="mt-1 max-w-56 text-sm text-muted-foreground">
          Link with people to see their Instants here.
        </p>
        <Button
          className="mt-5 rounded-full"
          nativeButton={false}
          render={<Link href="/connections" />}
          size="sm"
          variant="outline"
        >
          <UsersRound aria-hidden="true" className="size-4" />
          Find people
        </Button>
      </div>
    </div>
  );
}

function DeckComplete({
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}) {
  return (
    <div className="grid h-full place-items-center px-6 text-center">
      <div className="flex flex-col items-center">
        <div className="mb-5 grid size-14 place-items-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
          <Check
            aria-hidden="true"
            className="text-emerald-600"
            size={24}
          />
        </div>
        <p className="text-sm font-semibold">You&apos;re all caught up</p>
        <p className="mt-1 max-w-56 text-sm text-muted-foreground">
          You&apos;ve seen every Instant from your links.
        </p>
        <div className="mt-5 flex items-center gap-2">
          {hasMore ? (
            <Button
              className="rounded-full"
              disabled={loadingMore}
              onClick={onLoadMore}
              size="sm"
              type="button"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          ) : (
            <Button
              className="rounded-full"
              nativeButton={false}
              render={<Link href="/connections" />}
              size="sm"
              variant="outline"
            >
              <UsersRound aria-hidden="true" className="size-4" />
              Find people
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
