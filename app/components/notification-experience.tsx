"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { NotificationItem } from "@/src/features/notifications/client-api";
import { useNotificationStore } from "@/src/features/notifications/store";

const descriptions: Record<NotificationItem["type"], string> = {
  follow_request: "requested to follow you",
  follow_approved: "approved your follow request",
  new_follower: "started following you",
  like: "liked your Instant",
};

export function NotificationExperience() {
  const items = useNotificationStore((state) => state.items);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const cursor = useNotificationStore((state) => state.cursor);
  const loading = useNotificationStore((state) => state.loading);
  const loadingMore = useNotificationStore((state) => state.loadingMore);
  const pendingIds = useNotificationStore((state) => state.pendingIds);
  const error = useNotificationStore((state) => state.error);
  const load = useNotificationStore((state) => state.load);
  const loadMore = useNotificationStore((state) => state.loadMore);
  const markRead = useNotificationStore((state) => state.markRead);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="mt-6 scroll-mt-6 gap-0 py-0 shadow-none" id="notifications">
      <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <Bell aria-hidden="true" className="text-muted-foreground" size={19} />
          <div>
            <CardTitle className="text-base font-semibold">Notifications</CardTitle>
            <CardDescription className="mt-1 text-xs">
              {unreadCount ? `${unreadCount} unread` : "You are all caught up."}
            </CardDescription>
          </div>
        </div>
        {unreadCount > 0 && (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {unreadCount}
          </span>
        )}
      </CardHeader>
      <CardContent className="px-5">
        {error && (
          <p className="py-2 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="py-5 text-xs text-muted-foreground">Loading notifications...</p>
        ) : items.length === 0 ? (
          <p className="py-5 text-xs text-muted-foreground">
            Follow requests, new followers, and likes will appear here.
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {items.map((item, index) => (
              <li key={item.id}>
                <div
                  className={`flex items-center gap-3 py-3 ${
                    item.read ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      item.read ? "bg-transparent" : "bg-foreground"
                    }`}
                    aria-hidden="true"
                  />
                  <p className="m-0 flex-1 text-xs leading-5">
                    <Link
                      className="font-semibold hover:underline"
                      href={`/u/${encodeURIComponent(item.actorUsername)}`}
                    >
                      @{item.actorUsername}
                    </Link>{" "}
                    {descriptions[item.type]}
                    <time
                      className="mt-1 block text-[10px] text-muted-foreground"
                      dateTime={item.createdAt}
                    >
                      {formatDate(item.createdAt)}
                    </time>
                  </p>
                  {!item.read && (
                    <Button
                      aria-label="Mark notification as read"
                      className="size-8 text-muted-foreground"
                      disabled={pendingIds.has(item.id)}
                      onClick={() => void markRead(item)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <CheckCheck aria-hidden="true" size={16} />
                    </Button>
                  )}
                </div>
                {index < items.length - 1 && <Separator />}
              </li>
            ))}
          </ul>
        )}
        {cursor && (
          <Button
            className="mb-4 w-full"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            type="button"
            variant="outline"
          >
            {loadingMore ? "Loading..." : "Load older notifications"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}
