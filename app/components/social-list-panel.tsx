"use client";

import { Ban, LoaderCircle, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { Menu } from "@base-ui/react/menu";
import { Button } from "@/components/ui/button";
import type { ConnectionItem } from "@/src/features/social/client-api";
import { UserAvatar } from "@/app/components/user-avatar";

export type SocialSectionKind = "links" | "received" | "sent";

export function SocialListSection({
  kind,
  title,
  count,
  items,
  loading,
  loadingMore,
  nextCursor,
  pending,
  onLoadMore,
  onUnlink,
  onBlock,
  onDecide,
  onCancelRequest,
}: {
  kind: SocialSectionKind;
  title: string;
  count?: number;
  items: ConnectionItem[];
  loading: boolean;
  loadingMore: boolean;
  nextCursor: string | null;
  pending: string;
  onLoadMore: () => void;
  onUnlink?: (username: string) => void;
  onBlock?: (username: string) => void;
  onDecide?: (username: string, action: "approve" | "reject") => void;
  onCancelRequest?: (username: string) => void;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      {loading ? (
        <p
          className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground"
          role="status"
        >
          Loading...
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage(kind)}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl bg-muted/20 px-3">
          {items.map((item) => {
            const isPending = pending === item.username;
            return (
              <li
                className="flex min-h-[4rem] items-center gap-3 py-3"
                key={item.username}
              >
                <Link
                  aria-label={`Open @${item.username}'s profile`}
                  className="shrink-0 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                  href={`/u/${encodeURIComponent(item.username)}`}
                >
                  <UserAvatar
                    avatar={item.avatar}
                    name={item.name}
                    size={40}
                    userId={item.id}
                    username={item.username}
                  />
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
                  {kind === "links" && (
                    <Button
                      disabled={isPending}
                      onClick={() => onUnlink?.(item.username)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isPending ? (
                        <LoaderCircle aria-hidden="true" className="animate-spin" />
                      ) : (
                        "Unlink"
                      )}
                    </Button>
                  )}
                  {kind === "received" && (
                    <>
                      <Button
                        disabled={isPending}
                        onClick={() => onDecide?.(item.username, "approve")}
                        size="sm"
                        type="button"
                      >
                        {isPending ? (
                          <LoaderCircle aria-hidden="true" className="animate-spin" />
                        ) : (
                          "Accept link"
                        )}
                      </Button>
                      <Button
                        disabled={isPending}
                        onClick={() => onDecide?.(item.username, "reject")}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Decline
                      </Button>
                    </>
                  )}
                  {kind === "sent" && (
                    <Button
                      disabled={isPending}
                      onClick={() => onCancelRequest?.(item.username)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {isPending ? (
                        <LoaderCircle aria-hidden="true" className="animate-spin" />
                      ) : (
                        "Cancel"
                      )}
                    </Button>
                  )}
                  {kind === "links" && (
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
                            <Menu.Item
                              className="flex h-9 w-full items-center gap-2 px-2 text-sm text-destructive outline-none hover:bg-muted focus:bg-muted"
                              onClick={() => onBlock?.(item.username)}
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
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" /> Loading...
            </>
          ) : (
            "Load more"
          )}
        </Button>
      )}
    </section>
  );
}

function emptyMessage(kind: SocialSectionKind): string {
  return {
    links: "No links yet. Search for someone and send a link request.",
    received: "No incoming link requests.",
    sent: "No sent link requests waiting for acceptance.",
  }[kind];
}
