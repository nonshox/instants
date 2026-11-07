"use client";

import { Ban, LoaderCircle, MoreHorizontal, UserRound } from "lucide-react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { Button } from "@/components/ui/button";
import type { ConnectionItem } from "@/src/features/social/client-api";

export type SocialListKind = "followers" | "following" | "received" | "sent";

export function SocialListPanel({
  kind,
  items,
  loading,
  loadingMore,
  nextCursor,
  pending,
  onLoadMore,
  onFollow,
  onUnfollow,
  onRemoveFollower,
  onBlock,
  onDecide,
  onCancelRequest,
}: {
  kind: SocialListKind;
  items: ConnectionItem[];
  loading: boolean;
  loadingMore: boolean;
  nextCursor: string | null;
  pending: string;
  onLoadMore: () => void;
  onFollow: (username: string) => void;
  onUnfollow: (username: string) => void;
  onRemoveFollower: (username: string) => void;
  onBlock: (username: string) => void;
  onDecide: (username: string, action: "approve" | "reject") => void;
  onCancelRequest: (username: string) => void;
}) {
  const title = {
    followers: "Followers",
    following: "Following",
    received: "Received requests",
    sent: "Sent requests",
  }[kind];

  return (
    <section aria-label={title} className="mt-4">
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground" role="status">
          Loading {title.toLowerCase()}...
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage(kind)}
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {items.map((item) => {
            const isPending = pending === item.username;
            return (
              <li
                className="flex min-h-[4.25rem] items-center gap-3 py-3"
                key={item.username}
              >
                <Link
                  aria-label={`Open @${item.username}'s profile`}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                  href={`/u/${encodeURIComponent(item.username)}`}
                >
                  <UserRound aria-hidden="true" className="size-5" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    className="block truncate text-sm font-medium hover:underline"
                    href={`/u/${encodeURIComponent(item.username)}`}
                  >
                    {item.name || `@${item.username}`}
                  </Link>
                  {item.name && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      @{item.username}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {kind === "followers" && (
                    <Button
                      disabled={isPending || item.relationship === "requested"}
                      onClick={() => onFollow(item.username)}
                      size="sm"
                      type="button"
                      variant={item.relationship === "following" ? "outline" : "default"}
                    >
                      {isPending ? <LoaderCircle className="animate-spin" /> :
                        item.relationship === "following" ? "Following" :
                          item.relationship === "requested" ? "Requested" :
                            "Follow back"}
                    </Button>
                  )}
                  {kind === "following" && (
                    <Button
                      disabled={isPending}
                      onClick={() => onUnfollow(item.username)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isPending ? <LoaderCircle className="animate-spin" /> : "Unfollow"}
                    </Button>
                  )}
                  {kind === "received" && (
                    <>
                      <Button
                        disabled={isPending}
                        onClick={() => onDecide(item.username, "approve")}
                        size="sm"
                        type="button"
                      >
                        Accept
                      </Button>
                      <Button
                        disabled={isPending}
                        onClick={() => onDecide(item.username, "reject")}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {kind === "sent" && (
                    <Button
                      disabled={isPending}
                      onClick={() => onCancelRequest(item.username)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isPending ? <LoaderCircle className="animate-spin" /> : "Cancel"}
                    </Button>
                  )}
                  {(kind === "followers" || kind === "following") && (
                    <Menu.Root>
                      <Menu.Trigger
                        aria-label={`More actions for @${item.username}`}
                        render={
                          <Button
                            disabled={isPending}
                            size="icon"
                            type="button"
                            variant="ghost"
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </Button>
                        }
                      />
                      <Menu.Portal>
                        <Menu.Positioner align="end" sideOffset={4}>
                          <Menu.Popup className="z-50 min-w-40 rounded-lg bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/5 outline-none">
                            {kind === "followers" && (
                              <Menu.Item
                                className="flex h-9 w-full items-center px-2 text-sm outline-none hover:bg-muted focus:bg-muted"
                                onClick={() => onRemoveFollower(item.username)}
                              >
                                Remove follower
                              </Menu.Item>
                            )}
                            <Menu.Item
                              className="flex h-9 w-full items-center gap-2 px-2 text-sm text-destructive outline-none hover:bg-muted focus:bg-muted"
                              onClick={() => onBlock(item.username)}
                            >
                              <Ban aria-hidden="true" className="size-4" />
                              Block
                            </Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {nextCursor && (
        <Button
          className="mt-3 w-full"
          disabled={loadingMore}
          onClick={onLoadMore}
          type="button"
          variant="outline"
        >
          {loadingMore ? (
            <><LoaderCircle aria-hidden="true" className="animate-spin" /> Loading...</>
          ) : "Load more"}
        </Button>
      )}
    </section>
  );
}

function emptyMessage(kind: SocialListKind): string {
  return {
    followers: "No followers yet.",
    following: "You are not following anyone yet.",
    received: "No incoming follow requests.",
    sent: "No sent requests waiting for approval.",
  }[kind];
}
