"use client";

import Image from "next/image";
import { Heart, LoaderCircle, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ArchivedInstant } from "@/src/features/instants/archive";
import { formatInstantDate } from "@/src/features/instants/format-date";

export function PhotoPreviewDialog({
  photo,
  pending,
  onClose,
  onRetry,
  onDelete,
}: {
  photo: ArchivedInstant;
  pending: boolean;
  onClose: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(photo.image);
    let active = true;
    Promise.resolve().then(() => {
      if (active) setImageUrl(url);
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      active = false;
      URL.revokeObjectURL(url);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [onClose, photo.image]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label="Photo details"
        aria-modal="true"
        className="relative grid max-h-[90dvh] w-full max-w-3xl overflow-hidden rounded-2xl bg-background shadow-xl md:grid-cols-[minmax(0,1fr)_16rem]"
        role="dialog"
      >
        <Button
          aria-label="Close photo preview"
          autoFocus
          className="absolute right-3 top-3 z-10 rounded-full bg-background/90"
          onClick={onClose}
          size="icon"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
        <div className="relative min-h-56 bg-muted md:min-h-[28rem]">
          {imageUrl && (
            <Image
              alt={photo.caption || "Saved photo"}
              className="object-contain"
              fill
              sizes="(max-width: 768px) 100vw, 65vw"
              src={imageUrl}
              unoptimized
            />
          )}
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div>
            <p className="font-medium">{photo.caption || "No caption"}</p>
            <time className="mt-1 block text-sm text-muted-foreground">
              {formatInstantDate(new Date(photo.originalDate).toISOString())}
            </time>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart aria-hidden="true" className="size-4" />
            {photo.likes} likes
          </p>
          <div className="mt-auto grid gap-2">
            {photo.syncState !== "uploaded" && (
              <Button
                disabled={pending}
                onClick={onRetry}
                type="button"
                variant="outline"
              >
                {pending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <RotateCcw aria-hidden="true" />
                )}
                Share again
              </Button>
            )}
            <Button
              disabled={pending}
              onClick={onDelete}
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" />
              Delete photo
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
