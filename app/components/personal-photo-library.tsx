"use client";

import Link from "next/link";
import { ImagePlus, RefreshCw, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ArchivedInstant } from "@/src/features/instants/archive";
import { useInstantStore } from "@/src/features/instants/store";
import { PhotoLibraryTile } from "@/app/components/photo-library-tile";
import { InstantViewer } from "@/app/components/instant-viewer";

export function PersonalPhotoLibrary({ accountId }: { accountId: string }) {
  const photos = useInstantStore((state) => state.archive);
  const loading = useInstantStore((state) => state.archiveLoading);
  const error = useInstantStore((state) => state.archiveError);
  const pendingId = useInstantStore((state) => state.pendingDeleteId);
  const pendingCaptionId = useInstantStore((state) => state.pendingCaptionId);
  const initialize = useInstantStore((state) => state.initializeArchive);
  const refresh = useInstantStore((state) => state.refreshArchive);
  const retryShare = useInstantStore((state) => state.retryUpload);
  const deletePhoto = useInstantStore((state) => state.delete);
  const updateCaption = useInstantStore((state) => state.updateCaption);
  const [selected, setSelected] = useState<ArchivedInstant | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);
  const closePreview = useCallback(() => setSelected(null), []);

  useEffect(() => {
    void initialize(accountId);
  }, [accountId, initialize]);

  const orderedPhotos = [...photos].sort(
    (first, second) => second.originalDate - first.originalDate,
  );
  const failedPhotos = photos.filter((photo) => photo.syncState === "failed");

  const retryFailed = async () => {
    if (retryingAll || failedPhotos.length === 0) return;
    setRetryingAll(true);
    try {
      for (const photo of failedPhotos) {
        await retryShare(photo);
      }
    } finally {
      setRetryingAll(false);
    }
  };

  const permanentlyDelete = async (photo: ArchivedInstant) => {
    if (selected?.localId === photo.localId) setSelected(null);
    await deletePhoto(photo);
  };

  const selectedPhoto = selected
    ? photos.find((photo) => photo.localId === selected.localId) ?? selected
    : null;

  return (
    <section aria-labelledby="photos-title" className="mt-6 border-t border-border/60 pt-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold" id="photos-title">
            Photos
          </h2>
          {photos.length > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {photos.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            aria-label="Create an Instant"
            nativeButton={false}
            render={<Link href="/create" />}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ImagePlus aria-hidden="true" />
          </Button>
          <Button
            aria-label="Refresh your photos"
            disabled={loading}
            onClick={() => void refresh()}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <RefreshCw
              aria-hidden="true"
              className={loading ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </header>

      {failedPhotos.length > 0 && (
        <div
          className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2"
          role="status"
        >
          <p className="inline-flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            {failedPhotos.length} photo{failedPhotos.length === 1 ? "" : "s"} not shared
          </p>
          <Button
            disabled={retryingAll || loading}
            onClick={() => void retryFailed()}
            size="xs"
            type="button"
            variant="outline"
          >
            {retryingAll ? "Retrying..." : "Retry"}
          </Button>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center justify-between gap-3" role="alert">
          <p className="text-xs text-destructive">{error}</p>
          <Button
            disabled={loading}
            onClick={() => void refresh()}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      )}

      {loading && photos.length === 0 ? (
        <div
          className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2 md:grid-cols-6"
          role="status"
        >
          {Array.from({ length: 10 }, (_, index) => (
            <div
              aria-hidden="true"
              className="aspect-square animate-pulse rounded-lg bg-muted"
              key={index}
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="grid justify-items-center gap-2 py-10 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <ImagePlus aria-hidden="true" className="size-5" />
          </span>
          <p className="text-xs text-muted-foreground">No photos yet.</p>
          <Button
            nativeButton={false}
            render={<Link href="/create" />}
            size="sm"
            type="button"
            variant="outline"
          >
            Create an Instant
          </Button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-5 sm:gap-2 md:grid-cols-6">
          {orderedPhotos.map((photo) => (
            <PhotoLibraryTile
              key={photo.localId}
              onPreview={() => setSelected(photo)}
              photo={photo}
            />
          ))}
        </div>
      )}

      {selectedPhoto && (
        <InstantViewer
          captionPending={pendingCaptionId === selectedPhoto.localId}
          key={selectedPhoto.localId}
          mode="archive"
          onClose={closePreview}
          onDelete={() => void permanentlyDelete(selectedPhoto)}
          onRetry={() => void retryShare(selectedPhoto)}
          onUpdateCaption={(caption) => updateCaption(selectedPhoto, caption)}
          pending={pendingId === selectedPhoto.localId}
          photo={selectedPhoto}
        />
      )}
    </section>
  );
}
