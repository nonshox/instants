"use client";

import Link from "next/link";
import {
  ImagePlus,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArchivedInstant } from "@/src/features/instants/archive";
import { useInstantStore } from "@/src/features/instants/store";
import { PhotoLibraryTile } from "@/app/components/photo-library-tile";
import { PhotoPreviewDialog } from "@/app/components/photo-preview-dialog";

type PhotoFilter = "all" | "shared" | "device" | "retry";

const filters: { id: PhotoFilter; label: string }[] = [
  { id: "all", label: "All photos" },
  { id: "shared", label: "Shared" },
  { id: "device", label: "On this device" },
  { id: "retry", label: "Needs retry" },
];

export function PersonalPhotoLibrary({ accountId }: { accountId: string }) {
  const photos = useInstantStore((state) => state.archive);
  const loading = useInstantStore((state) => state.archiveLoading);
  const error = useInstantStore((state) => state.archiveError);
  const pendingId = useInstantStore((state) => state.pendingDeleteId);
  const initialize = useInstantStore((state) => state.initializeArchive);
  const refresh = useInstantStore((state) => state.refreshArchive);
  const retryShare = useInstantStore((state) => state.retryUpload);
  const deletePhoto = useInstantStore((state) => state.delete);
  const [filter, setFilter] = useState<PhotoFilter>("all");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selected, setSelected] = useState<ArchivedInstant | null>(null);
  const closePreview = useCallback(() => setSelected(null), []);

  useEffect(() => {
    void initialize(accountId);
  }, [accountId, initialize]);

  const visiblePhotos = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return photos
      .filter((photo) => {
        const matchesFilter =
          filter === "all" ||
          (filter === "shared" && photo.syncState === "uploaded") ||
          (filter === "device" && photo.syncState === "local") ||
          (filter === "retry" && photo.syncState === "failed");
        const matchesQuery =
          !normalizedQuery ||
          photo.caption.toLocaleLowerCase().includes(normalizedQuery);
        return matchesFilter && matchesQuery;
      })
      .sort((first, second) =>
        sortOrder === "newest"
          ? second.originalDate - first.originalDate
          : first.originalDate - second.originalDate,
      );
  }, [filter, photos, query, sortOrder]);

  const permanentlyDelete = async (photo: ArchivedInstant) => {
    if (
      !window.confirm(
        "Permanently delete this photo from your device and, if shared, from Mono?",
      )
    ) {
      return;
    }
    if (selected?.localId === photo.localId) setSelected(null);
    await deletePhoto(photo);
  };
  const selectedPhoto = selected
    ? photos.find((photo) => photo.localId === selected.localId) ?? selected
    : null;

  return (
    <section aria-labelledby="photos-title" className="mt-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Only you can see these</p>
          <h2 className="text-xl font-semibold tracking-tight" id="photos-title">
            Your photos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared photos expire; your saved copies stay here.
          </p>
        </div>
        <Button
          aria-label="Refresh your photos"
          disabled={loading}
          onClick={() => void refresh()}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RefreshCw
            aria-hidden="true"
            className={loading ? "animate-spin" : ""}
          />
        </Button>
      </header>

      <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search captions"
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search captions"
            type="search"
            value={query}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Sort
          <select
            aria-label="Sort photos"
            className="h-9 rounded-lg bg-background px-3 text-sm text-foreground ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onChange={(event) =>
              setSortOrder(event.target.value as "newest" | "oldest")
            }
            value={sortOrder}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>

      <div
        aria-label="Filter photos"
        className="mt-4 flex gap-1 overflow-x-auto pb-1"
        role="group"
      >
        {filters.map((item) => (
          <Button
            aria-pressed={filter === item.id}
            className="shrink-0"
            key={item.id}
            onClick={() => setFilter(item.id)}
            size="sm"
            type="button"
            variant={filter === item.id ? "secondary" : "ghost"}
          >
            {item.label}
            {item.id === "all" && (
              <span className="text-xs text-muted-foreground">{photos.length}</span>
            )}
          </Button>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-3" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            disabled={loading}
            onClick={() => void refresh()}
            type="button"
            variant="outline"
          >
            Try again
          </Button>
        </div>
      )}

      {loading && photos.length === 0 ? (
        <p className="py-8 text-sm text-muted-foreground" role="status">
          Loading your photos...
        </p>
      ) : visiblePhotos.length === 0 ? (
        <div className="grid justify-items-center gap-3 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <ImagePlus aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">
              {photos.length === 0 ? "Your photo collection starts here" : "No photos found"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {photos.length === 0
                ? "Create an Instant to keep a private copy here."
                : "Try another search or filter."}
            </p>
          </div>
          {photos.length === 0 && (
            <Button
              nativeButton={false}
              render={<Link href="/create" />}
              variant="outline"
            >
              Create an Instant
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visiblePhotos.map((photo) => (
            <PhotoLibraryTile
              key={photo.localId}
              onDelete={() => void permanentlyDelete(photo)}
              onPreview={() => setSelected(photo)}
              onRetry={() => void retryShare(photo)}
              pending={pendingId === photo.localId}
              photo={photo}
            />
          ))}
        </div>
      )}

      {selectedPhoto && (
        <PhotoPreviewDialog
          onClose={closePreview}
          onDelete={() => void permanentlyDelete(selectedPhoto)}
          onRetry={() => void retryShare(selectedPhoto)}
          pending={pendingId === selectedPhoto.localId}
          photo={selectedPhoto}
        />
      )}
    </section>
  );
}
