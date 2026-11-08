"use client";

import Image from "next/image";
import {
  Check,
  Heart,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { FeedInstant } from "@/src/features/instants/client-api";
import type { ArchivedInstant } from "@/src/features/instants/archive";
import { formatInstantDate } from "@/src/features/instants/format-date";
import { UserAvatar } from "@/app/components/user-avatar";

type FeedConfig = {
  mode: "feed";
  instant: FeedInstant;
  pendingLike: boolean;
  onToggleLike: (instant: FeedInstant, liked: boolean) => void;
};

type ArchiveConfig = {
  mode: "archive";
  photo: ArchivedInstant;
  pending: boolean;
  captionPending: boolean;
  onRetry: () => void;
  onDelete: () => void;
  onUpdateCaption: (caption: string) => Promise<boolean>;
};

type InstantViewerProps = (FeedConfig | ArchiveConfig) & { onClose: () => void };



export function InstantViewer(props: InstantViewerProps) {
  const { onClose } = props;
  const isFeed = props.mode === "feed";

  // Feed images are served by a route; archive images are local blobs that
  // need an object URL.
  const archiveImage = isFeed ? null : props.photo.image;
  const [blobUrl, setBlobUrl] = useState("");
  useEffect(() => {
    if (!archiveImage) return undefined;
    const url = URL.createObjectURL(archiveImage);
    let active = true;
    Promise.resolve().then(() => {
      if (active) setBlobUrl(url);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [archiveImage]);

  const imageUrl = isFeed ? props.instant.imageUrl : blobUrl;
  const caption = isFeed ? props.instant.caption : props.photo.caption;
  const dateIso = isFeed
    ? props.instant.createdAt
    : new Date(props.photo.originalDate).toISOString();
  const imageAlt = isFeed
    ? `Instant shared by @${props.instant.username}`
    : caption || "Saved photo";

  const [likedFlash, setLikedFlash] = useState(0);
  const flashTimer = useRef<number | null>(null);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(caption);
  const [captionError, setCaptionError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, [onClose]);

  const handleDoubleTap = () => {
    if (!isFeed) return;
    setLikedFlash((count) => count + 1);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setLikedFlash(0), 700);
    if (!props.instant.likedByViewer && !props.pendingLike) {
      props.onToggleLike(props.instant, true);
    }
  };

  const saveCaption = async () => {
    if (isFeed) return;
    const next = captionDraft.trim().replace(/\s+/g, " ");
    if (!isCaptionValid(next)) {
      setCaptionError("Keep the caption to one short line.");
      return;
    }
    setCaptionError("");
    const saved = await props.onUpdateCaption(next);
    if (saved) {
      setEditingCaption(false);
    } else {
      setCaptionError("The caption could not be saved. Try again.");
    }
  };

  const cancelCaptionEdit = () => {
    setCaptionDraft(caption);
    setCaptionError("");
    setEditingCaption(false);
  };

  const onCaptionKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void saveCaption();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelCaptionEdit();
    }
  };

  const captionIsValid = isCaptionValid(captionDraft);

  return (
    <div
      aria-modal="true"
      aria-label={isFeed ? `Instant by @${props.instant.username}` : "Photo details"}
      className="fixed inset-0 z-50 isolate flex flex-col overflow-hidden bg-white text-foreground dark:bg-neutral-950"
      role="dialog"
    >
      {/* Soft ambient backdrop */}
      {imageUrl && (
        <Image
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 scale-125 object-cover opacity-30 blur-3xl"
          fill
          sizes="100vw"
          src={imageUrl}
          unoptimized
        />
      )}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-white/65 dark:bg-neutral-950/70"
      />

      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 bg-gradient-to-b from-white/85 to-transparent px-4 pb-8 pt-4 sm:px-6 dark:from-neutral-950/85">
        {isFeed ? (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              avatar={props.instant.avatar}
              size={34}
              userId={props.instant.ownerId}
              username={props.instant.username}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-5">
                @{props.instant.username}
              </p>
              <time
                className="block text-[11px] leading-4 text-muted-foreground"
                dateTime={dateIso}
              >
                {formatInstantDate(dateIso)}
              </time>
            </div>
          </div>
        ) : (
          <StatusPill syncState={props.photo.syncState} />
        )}
        <button
          aria-label="Close"
          autoFocus
          className="grid size-10 shrink-0 place-items-center rounded-full bg-black/5 outline-none backdrop-blur-sm transition hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-ring dark:bg-white/10 dark:hover:bg-white/15"
          onClick={onClose}
          type="button"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </header>

      {/* Photo */}
      <div
        className={`relative grid min-h-0 flex-1 select-none place-items-center [container-type:size] ${
          isFeed ? "cursor-pointer" : ""
        }`}
        onDoubleClick={handleDoubleTap}
      >
        <div className="relative aspect-square size-[96cqmin] overflow-hidden rounded-[1.5rem] shadow-[0_14px_40px_-12px_rgba(0,0,0,0.3)] ring-1 ring-black/10 dark:ring-white/10">
          {imageUrl && (
            <Image
              alt={imageAlt}
              className="object-contain"
              fill
              priority
              sizes="100vw"
              src={imageUrl}
              unoptimized
            />
          )}
        </div>
        {likedFlash > 0 && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 grid place-items-center"
            key={likedFlash}
          >
            <Heart
              className="animate-in zoom-in-50 fill-rose-500 text-rose-500 drop-shadow-xl duration-300"
              size={84}
              strokeWidth={1.5}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-t from-white/85 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8 sm:px-6 dark:from-neutral-950/85">
        {isFeed ? (
          <>
            {props.instant.caption && (
              <p className="mb-3 line-clamp-2 text-sm leading-snug text-foreground/85">
                <span className="mr-1.5 font-semibold text-foreground">
                  @{props.instant.username}
                </span>
                {props.instant.caption}
              </p>
            )}
            <div className="flex items-center gap-4">
              <button
                aria-label={props.instant.likedByViewer ? "Unlike Instant" : "Like Instant"}
                aria-pressed={props.instant.likedByViewer}
                className="inline-flex size-11 items-center justify-center rounded-full outline-none transition active:scale-90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                disabled={props.pendingLike}
                onClick={() => props.onToggleLike(props.instant, !props.instant.likedByViewer)}
                type="button"
              >
                <Heart
                  aria-hidden="true"
                  className={`size-7 transition-colors ${
                    props.instant.likedByViewer
                      ? "fill-rose-500 text-rose-500"
                      : "text-foreground"
                  }`}
                  strokeWidth={1.8}
                />
              </button>
              <span className="text-sm font-semibold tabular-nums text-foreground/85">
                {props.instant.likes.toLocaleString()}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {props.instant.likes === 1 ? "like" : "likes"}
                </span>
              </span>
            </div>
          </>
        ) : (
          <>
            {/* Caption — inline editable */}
            <div className="mb-2 flex items-start justify-between gap-2">
              {editingCaption ? (
                <div className="grid min-w-0 flex-1 gap-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      aria-label="Edit caption"
                      autoFocus
                      className="h-9 min-w-0 flex-1 rounded-lg bg-black/5 px-3 text-sm text-foreground outline-none ring-1 ring-black/10 placeholder:text-black/35 focus:ring-black/25 dark:bg-white/10 dark:ring-white/10 dark:placeholder:text-white/40 dark:focus:ring-white/25"
                      maxLength={100}
                      onChange={(event) => {
                        setCaptionDraft(event.target.value.replace(/[\r\n]+/g, " "));
                        setCaptionError("");
                      }}
                      onKeyDown={onCaptionKeyDown}
                      placeholder="Write a few words..."
                      value={captionDraft}
                    />
                    <button
                      aria-label="Save caption"
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-foreground outline-none transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 dark:hover:bg-white/10"
                      disabled={!captionIsValid || props.captionPending}
                      onClick={() => void saveCaption()}
                      type="button"
                    >
                      {props.captionPending ? (
                        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                      ) : (
                        <Check aria-hidden="true" className="size-4" />
                      )}
                    </button>
                    <button
                      aria-label="Cancel caption edit"
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground outline-none transition hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/10"
                      onClick={cancelCaptionEdit}
                      type="button"
                    >
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  {captionError && (
                    <p className="text-[11px] text-destructive" role="alert">
                      {captionError}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="min-w-0 text-sm leading-snug text-foreground/85">
                    {props.photo.caption || (
                      <span className="text-muted-foreground">No caption</span>
                    )}
                  </p>
                  <button
                    aria-label="Edit caption"
                    className="-mr-1 -mt-1.5 grid shrink-0 place-items-center rounded-lg p-2 text-muted-foreground outline-none transition hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-white/10"
                    onClick={() => {
                      setCaptionDraft(props.photo.caption);
                      setCaptionError("");
                      setEditingCaption(true);
                    }}
                    type="button"
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </button>
                </>
              )}
            </div>

            {/* Meta strip */}
            <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <span>{formatInstantDate(dateIso)}</span>
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {props.photo.syncState !== "uploaded" && (
                <button
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-black/15 text-xs font-medium text-foreground outline-none transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
                  disabled={props.pending || props.photo.syncState === "uploading"}
                  onClick={props.onRetry}
                  type="button"
                >
                  {props.pending || props.photo.syncState === "uploading" ? (
                    <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw aria-hidden="true" className="size-4" />
                  )}
                  Share now
                </button>
              )}
              {confirmDelete ? (
                <div className="grid flex-1 grid-cols-[1fr_auto] gap-2">
                  <button
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-destructive text-xs font-semibold text-white outline-none transition hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    disabled={props.pending}
                    onClick={props.onDelete}
                    type="button"
                  >
                    {props.pending ? (
                      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                    ) : (
                      <Trash2 aria-hidden="true" className="size-4" />
                    )}
                    Delete forever
                  </button>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-full border border-black/15 px-4 text-xs font-medium text-muted-foreground outline-none transition hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring dark:border-white/15 dark:hover:bg-white/10"
                    onClick={() => setConfirmDelete(false)}
                    type="button"
                  >
                    Keep
                  </button>
                </div>
              ) : (
                <button
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-full border border-black/10 text-xs font-medium text-muted-foreground outline-none transition hover:border-destructive/35 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:border-white/10"
                  disabled={props.pending || props.photo.syncState === "uploading"}
                  onClick={() => setConfirmDelete(true)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Delete photo
                </button>
              )}
            </div>
          </>
        )}
      </footer>
    </div>
  );
}

function StatusPill({ syncState }: { syncState: ArchivedInstant["syncState"] }) {
  const status = STATUS[syncState];
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 py-1.5 pl-3 pr-4 text-[11px] font-medium text-foreground/80 backdrop-blur-sm dark:border-white/10 dark:bg-white/10 dark:text-foreground/85">
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${status.dot}`}
      />
      {status.label}
    </span>
  );
}

const STATUS: Record<
  ArchivedInstant["syncState"],
  { label: string; dot: string }
> = {
  uploaded: { label: "Shared", dot: "bg-emerald-500" },
  uploading: { label: "Sharing...", dot: "animate-pulse bg-amber-500" },
  failed: { label: "Not shared", dot: "bg-amber-500" },
  local: { label: "On this device", dot: "bg-black/30 dark:bg-white/50" },
};

function isCaptionValid(value: string): boolean {
  const caption = value.trim();
  return (
    caption.length <= 60 &&
    !/[\r\n]/.test(value)
  );
}
