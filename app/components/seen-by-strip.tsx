
"use client";

import { ChevronDown, Eye, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  fetchInstantViewers,
  resolveViewerProfiles,
  type InstantViewer,
  type ResolvedProfile,
} from "@/src/features/instants/client-api";
import type { ArchivedInstant } from "@/src/features/instants/archive";
import { formatRelativeTime } from "@/src/features/instants/format-date";
import { UserAvatar } from "@/app/components/user-avatar";

/**
 * Owner-facing engagement strip for one of their own Instants.
 *
 * Data sources:
 *   - local engagement snapshot (IndexedDB) — always available, even after
 *     the Instant expires and the server rows are gone; ids are resolved to
 *     CURRENT identities live;
 *   - server `/views` — fallback while the snapshot has not been synced yet
 *     (the Instant is still live).
 */
export function SeenByStrip({ photo }: { photo: ArchivedInstant }) {
  const engagement = photo.engagement;
  const serverId = photo.serverId;

  if (!engagement && !serverId) return null; // never shared
  if (engagement) return <EngagementStrip photo={photo} />;
  return <ServerStrip instantId={serverId!} totalLikes={photo.likes} />;
}

type Loaded<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error" };

function EngagementStrip({ photo }: { photo: ArchivedInstant }) {
  const engagement = photo.engagement!;
  const [resolved, setResolved] = useState<Loaded<Map<string, ResolvedProfile>>>(
    { status: "loading" },
  );
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setResolved({ status: "loading" });
    try {
      const ids = [...new Set(engagement.viewers.map((v) => v.userId))];
      const map = await resolveViewerProfiles(ids);
      setResolved({ status: "ready", value: map });
    } catch {
      // Local snapshots are still fully inspectable — only identities failed.
      setResolved({ status: "ready", value: new Map() });
    }
  }, [engagement]);

  useEffect(() => {
    let active = true;
    const ids = [...new Set(engagement.viewers.map((v) => v.userId))];
    resolveViewerProfiles(ids).then(
      (map) => {
        if (active) setResolved({ status: "ready", value: map });
      },
      () => {
        if (active) setResolved({ status: "ready", value: new Map() });
      },
    );
    return () => {
      active = false;
    };
  }, [engagement]);

  const viewers = engagement.viewers;
  const isEmpty = viewers.length === 0;

  const rows: DisplayViewer[] = viewers.map((viewer) => {
    const profile = resolved.status === "ready" ? resolved.value.get(viewer.userId) : undefined;
    return {
      userId: viewer.userId,
      seenAt: viewer.seenAt,
      reaction: viewer.reaction,
      username: profile?.resolvable ? profile.username : "",
      avatar: profile?.resolvable ? profile.avatar : "",
    };
  });

  const reactions = Object.entries(engagement.reactions).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="mb-2 rounded-xl border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/5">
      {reactions.length > 0 && (
        <div
          aria-label="Reactions"
          className="flex h-8 items-center gap-2 border-b border-black/5 px-3 dark:border-white/5"
        >
          {reactions.map(([emoji, count]) => (
            <span
              className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80"
              key={emoji}
            >
              <span aria-hidden="true">{emoji}</span>
              <span className="tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      )}

      {isEmpty ? (
        <p className="flex h-9 items-center gap-2 px-3 text-xs text-muted-foreground">
          <Eye aria-hidden="true" className="size-4 shrink-0" />
          Not seen yet
        </p>
      ) : resolved.status === "loading" ? (
        <StripSkeleton />
      ) : resolved.status === "error" ? (
        <StripError onRetry={() => void load()} />
      ) : (
        <ViewersList
          expanded={expanded}
          onToggle={() => setExpanded((value) => !value)}
          viewers={rows}
        />
      )}
    </div>
  );
}

function ServerStrip({
  instantId,
  totalLikes,
}: {
  instantId: string;
  totalLikes: number;
}) {
  const [viewers, setViewers] = useState<Loaded<InstantViewer[]>>({
    status: "loading",
  });
  const [expanded, setExpanded] = useState(false);

  // Silent background refresh — the owner watches viewers/reactions roll in
  // live while their Instant is open. Pauses when the tab is hidden.
  const refresh = useCallback(async () => {
    try {
      const value = await fetchInstantViewers(instantId);
      setViewers({ status: "ready", value });
    } catch {
      /* keep the last known list — never churn the UI on transient errors */
    }
  }, [instantId]);

  const load = useCallback(async () => {
    setViewers({ status: "loading" });
    try {
      setViewers({ status: "ready", value: await fetchInstantViewers(instantId) });
    } catch {
      setViewers({ status: "error" });
    }
  }, [instantId]);

  useEffect(() => {
    let active = true;
    fetchInstantViewers(instantId).then(
      (value) => {
        if (active) setViewers({ status: "ready", value });
      },
      () => {
        if (active) setViewers({ status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [instantId]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const rows: DisplayViewer[] =
    viewers.status === "ready" ? viewers.value : [];

  return (
    <div className="mb-2 rounded-xl border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/5">
      {totalLikes > 0 && (
        <div
          aria-label="Reactions"
          className="flex h-8 items-center justify-between gap-2 border-b border-black/5 px-3 text-xs font-medium text-foreground/80 dark:border-white/5"
        >
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true">❤️</span>
            <span className="tabular-nums">{totalLikes}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">
            <span
              aria-hidden="true"
              className="size-1.5 animate-pulse rounded-full bg-emerald-500"
            />
            Live
          </span>
        </div>
      )}
      {viewers.status === "loading" ? (
        <StripSkeleton />
      ) : viewers.status === "error" ? (
        <StripError onRetry={() => void load()} />
      ) : viewers.value.length === 0 ? (
        <p className="flex h-9 items-center gap-2 px-3 text-xs text-muted-foreground">
          <Eye aria-hidden="true" className="size-4 shrink-0" />
          Not seen yet
        </p>
      ) : (
        <ViewersList
          expanded={expanded}
          onToggle={() => setExpanded((value) => !value)}
          viewers={rows}
        />
      )}
    </div>
  );
}

type DisplayViewer = {
  userId: string;
  username: string;
  avatar: string;
  seenAt: string;
  reaction: string | null;
};

function ViewersList({
  expanded,
  onToggle,
  viewers,
}: {
  expanded: boolean;
  onToggle: () => void;
  viewers: DisplayViewer[];
}) {
  const preview = viewers.slice(0, 5);
  const label = `Seen by ${viewers.length} ${viewers.length === 1 ? "person" : "people"}`;

  return (
    <>
      <button
        aria-expanded={expanded}
        aria-label={label}
        className="flex h-11 w-full items-center gap-2.5 rounded-xl px-3 outline-none transition hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/[0.04]"
        onClick={onToggle}
        type="button"
      >
        <Eye aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span aria-hidden="true" className="flex -space-x-2">
          {preview.map((viewer) => (
            <UserAvatar
              avatar={viewer.avatar}
              className="ring-2 ring-background"
              key={viewer.userId}
              size={22}
              userId={viewer.userId}
              username={viewer.username || "?"}
            />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-xs font-medium">
          {label}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && (
        <ul className="max-h-44 overflow-y-auto border-t border-black/5 px-3 py-2 dark:border-white/5">
          {viewers.map((viewer) => (
            <li className="flex h-9 items-center gap-2.5" key={viewer.userId}>
              <UserAvatar
                avatar={viewer.avatar}
                size={24}
                userId={viewer.userId}
                username={viewer.username || "unknown"}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {viewer.username ? `@${viewer.username}` : "Someone you don't know"}
              </span>
              {viewer.reaction && (
                <span aria-hidden="true" className="shrink-0 text-sm">
                  {viewer.reaction}
                </span>
              )}
              <time
                className="shrink-0 text-[11px] text-muted-foreground"
                dateTime={viewer.seenAt}
              >
                {formatRelativeTime(viewer.seenAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function StripSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex h-9 animate-pulse items-center gap-2 px-3"
    >
      <div className="size-4 rounded-full bg-muted" />
      <div className="h-2.5 w-24 rounded-full bg-muted" />
    </div>
  );
}

function StripError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-9 items-center justify-between gap-2 px-3">
      <span className="text-xs text-muted-foreground">Views unavailable</span>
      <button
        aria-label="Retry loading views"
        className="grid size-7 place-items-center rounded-full text-muted-foreground outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onRetry}
        type="button"
      >
        <RotateCcw aria-hidden="true" size={14} />
      </button>
    </div>
  );
}
