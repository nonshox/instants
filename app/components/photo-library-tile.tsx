"use client";

import Image from "next/image";
import { Check, Heart, LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ArchivedInstant } from "@/src/features/instants/archive";
import { formatInstantDate } from "@/src/features/instants/format-date";

export function PhotoLibraryTile({
  photo,
  pending,
  onPreview,
  onRetry,
  onDelete,
}: {
  photo: ArchivedInstant;
  pending: boolean;
  onPreview: () => void;
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
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [photo.image]);

  const status =
    photo.syncState === "uploaded"
      ? "Shared"
      : photo.syncState === "failed"
        ? "Not shared"
        : photo.syncState === "uploading"
          ? "Sharing..."
          : "On this device";

  return (
    <article className="group overflow-hidden rounded-xl bg-card ring-1 ring-border/70">
      <button
        aria-label={`View photo: ${photo.caption || "no caption"}`}
        className="relative block aspect-square w-full bg-muted text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onPreview}
        type="button"
      >
        {imageUrl && (
          <Image
            alt=""
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            src={imageUrl}
            unoptimized
          />
        )}
      </button>
      <div className="p-3">
        <p className="truncate text-sm font-medium">
          {photo.caption || "No caption"}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{status}</span>
          <span>{formatInstantDate(new Date(photo.originalDate).toISOString())}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Heart aria-hidden="true" className="size-3.5" />
            {photo.likes}
          </span>
          <div className="flex items-center gap-1">
            {photo.syncState !== "uploaded" && (
              <Button
                aria-label="Share photo again"
                disabled={pending || photo.syncState === "uploading"}
                onClick={onRetry}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                {pending ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <RotateCcw aria-hidden="true" />
                )}
              </Button>
            )}
            {photo.syncState === "uploaded" && (
              <Check
                aria-label="Shared"
                className="mr-2 size-4 text-muted-foreground"
              />
            )}
            <Button
              aria-label="Delete photo"
              disabled={pending || photo.syncState === "uploading"}
              onClick={onDelete}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
