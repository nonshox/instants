"use client";

import { Bell, Check, CheckCheck, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { NotificationItem } from "@/src/features/notifications/client-api";
import { useNotificationStore } from "@/src/features/notifications/store";
import { UserAvatar } from "@/app/components/user-avatar";

const descriptions: Record<NotificationItem["type"], string> = {
  link_request: "sent you a link request",
  link_accepted: "accepted your link request",
  follow_request: "requested to link with you",
  follow_approved: "accepted your link request",
  new_follower: "linked with you",
  like: "liked your Instant",
};

const filters = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "likes", label: "Likes" },
  { id: "links", label: "Links" },
] as const;

type FilterId = (typeof filters)[number]["id"];

const linkTypes = new Set<NotificationItem["type"]>([
  "link_request",
  "link_accepted",
  "follow_request",
  "follow_approved",
  "new_follower",
]);

export function NotificationExperience() {
  const items = useNotificationStore((state) => state.items);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const cursor = useNotificationStore((state) => state.cursor);
  const loading = useNotificationStore((state) => state.loading);
  const loadingMore = useNotificationStore((state) => state.loadingMore);
  const pendingIds = useNotificationStore((state) => state.pendingIds);
  const error = useNotificationStore((state) => state.error);
  const loaded = useNotificationStore((state) => state.loaded);
  const load = useNotificationStore((state) => state.load);
  const loadMore = useNotificationStore((state) => state.loadMore);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);

  const [filter, setFilter] = useState<FilterId>("all");

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        if (filter === "all") return true;
        if (filter === "unread") return !item.read;
        if (filter === "likes") return item.type === "like";
        return linkTypes.has(item.type);
      }),
    [filter, items],
  );

  const groups = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today: NotificationItem[] = [];
    const earlier: NotificationItem[] = [];
    for (const item of filtered) {
      (new Date(item.createdAt) >= startOfToday ? today : earlier).push(item);
    }
    return [
      { label: "Today", items: today },
      { label: "Earlier", items: earlier },
    ].filter((group) => group.items.length > 0);
  }, [filtered]);

  useEffect(() => {
    void load();
  }, [load]);

  const emptyMessage =
    filter === "all"
      ? "You're all caught up."
      : filter === "unread"
        ? "No unread notifications."
        : filter === "likes"
          ? "No likes yet."
          : "No link activity yet.";

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* Header */}
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Notifications</h1>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            className="rounded-full"
            disabled={pendingIds.size > 0}
            onClick={() => void markAllRead()}
            size="sm"
            type="button"
            variant="outline"
          >
            <CheckCheck aria-hidden="true" />
            Mark all read
          </Button>
        )}
      </header>

      {/* Filters */}
      <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter notifications">
        {filters.map((item) => {
          const isActive = filter === item.id;
          return (
            <button
              aria-pressed={isActive}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              key={item.id}
              onClick={() => setFilter(item.id)}
              type="button"
            >
              {item.label}
              {item.id === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 tabular-nums opacity-70">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4 py-3" role="alert">
          <p className="text-xs text-destructive">{error}</p>
          <Button
            disabled={loading}
            onClick={() => void load(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}

      {/* List */}
      {loading && !loaded ? (
        <ul className="mt-2 divide-y divide-border/60" role="status">
          {Array.from({ length: 6 }, (_, index) => (
            <li className="flex items-center gap-3 py-3.5" key={index}>
              <div className="size-9 animate-pulse rounded-full bg-muted" />
              <div className="grid flex-1 gap-1.5">
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
                <div className="h-2.5 w-1/4 animate-pulse rounded-full bg-muted" />
              </div>
            </li>
          ))}
        </ul>
      ) : groups.length === 0 ? (
        <div className="grid justify-items-center gap-3 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
            <Bell aria-hidden="true" className="size-6" />
          </span>
          <p className="text-sm font-medium">{emptyMessage}</p>
        </div>
      ) : (
        <div className="mt-2">
          {groups.map((group) => (
            <section aria-label={group.label} key={group.label}>
              <h2 className="px-1 pb-1.5 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {group.label}
              </h2>
              <ul className="divide-y divide-border/60 border-y border-border/60">
                {group.items.map((item) => (
                  <NotificationRow
                    item={item}
                    key={item.id}
                    markRead={markRead}
                    pending={pendingIds.has(item.id)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {cursor && (
        <div className="mt-5 flex justify-center">
          <Button
            className="min-w-36 rounded-full"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            type="button"
            variant="outline"
          >
            {loadingMore ? "Loading..." : "Load older"}
          </Button>
        </div>
      )}
    </div>
  );
}



function NotificationRow({
  item,
  pending,
  markRead,
}: {
  item: NotificationItem;
  pending: boolean;
  markRead: (item: NotificationItem) => Promise<void>;
}) {
  return (
    <li className="flex items-center gap-3 px-1 py-3">
      <Link
        aria-label={`Open @${item.actorUsername}'s profile`}
        className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/u/${encodeURIComponent(item.actorUsername)}`}
      >
        <UserAvatar
          avatar={item.actorAvatar}
          size={38}
          userId={item.actorId}
          username={item.actorUsername}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug">
          <Link
            className="font-semibold hover:underline"
            href={`/u/${encodeURIComponent(item.actorUsername)}`}
          >
            @{item.actorUsername}
          </Link>{" "}
          <span className="text-foreground/85">{descriptions[item.type]}</span>
        </p>
        <time
          className="mt-0.5 block text-[10px] font-medium text-muted-foreground"
          dateTime={item.createdAt}
        >
          {formatRelativeTime(item.createdAt)}
        </time>
      </div>
      {!item.read && (
        <button
          aria-label="Mark as read"
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          disabled={pending}
          onClick={() => void markRead(item)}
          type="button"
        >
          <Check aria-hidden="true" className="size-4" />
        </button>
      )}
    </li>
  );
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}
