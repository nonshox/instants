"use client";

import Image from "next/image";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import type { ArchivedInstant } from "@/src/features/instants/archive";

export function PhotoLibraryTile({
  photo,
  onPreview,
}: {
  photo: ArchivedInstant;
  onPreview: () => void;
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

  return (
    <button
      aria-label="Open photo"
      className="group relative aspect-square w-full overflow-hidden rounded-md bg-muted outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onPreview}
      type="button"
    >
      {imageUrl && (
        <Image
          alt=""
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          fill
          sizes="(max-width: 640px) 25vw, (max-width: 768px) 20vw, 17vw"
          src={imageUrl}
          unoptimized
        />
      )}
      {photo.syncState === "uploaded" && (
        <span
          aria-label="Shared"
          className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm"
          role="status"
          title="Shared"
        >
          <Check aria-hidden="true" className="size-2.5" strokeWidth={3} />
        </span>
      )}
      {photo.syncState === "failed" && (
        <span
          aria-label="Not shared"
          className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-amber-500/90 text-black backdrop-blur-sm"
          role="status"
          title="Not shared"
        >
          <TriangleAlert aria-hidden="true" className="size-2.5" strokeWidth={2.75} />
        </span>
      )}
      {photo.syncState === "uploading" && (
        <span
          aria-label="Sharing"
          className="absolute inset-0 grid place-items-center bg-black/35 text-white"
          role="status"
        >
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        </span>
      )}
    </button>
  );
}
