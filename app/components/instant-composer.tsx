"use client";

import Image from "next/image";
import {
  Check,
  ImagePlus,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useInstantStore } from "@/src/features/instants/store";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10_000_000;

export function InstantComposer() {
  const uploading = useInstantStore((state) => state.uploading);
  const archiveError = useInstantStore((state) => state.archiveError);
  const uploadMessage = useInstantStore((state) => state.uploadMessage);
  const uploadInstant = useInstantStore((state) => state.upload);
  const clearUploadMessage = useInstantStore(
    (state) => state.clearUploadMessage,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  const [caption, setCaption] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    let active = true;
    Promise.resolve().then(() => {
      if (active) setPreview({ file, url });
    });
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const chooseFile = (nextFile: File | null) => {
    setFile(nextFile);
    clearUploadMessage();
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    chooseFile(event.target.files?.[0] ?? null);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0] ?? null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fileIsValid || !captionIsValid || !file) return;

    const saved = await uploadInstant(file, caption);
    if (saved) {
      setFile(null);
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const fileIsValid = Boolean(
    file &&
      file.size > 0 &&
      file.size <= MAX_IMAGE_BYTES &&
      ACCEPTED_IMAGE_TYPES.includes(file.type),
  );
  const captionIsValid = isCaptionValid(caption);
  const previewUrl = preview?.file === file ? preview.url : "";

  return (
    <section aria-labelledby="create-instant-title">
      <header className="mb-6 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
          <ImagePlus aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            id="create-instant-title"
          >
            Create an Instant
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share a moment. A private copy is saved to your archive.
          </p>
        </div>
      </header>

      <form
        className="grid gap-6 rounded-2xl bg-card p-4 ring-1 ring-border/70 sm:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(17rem,0.9fr)]"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="grid content-start gap-3">
          <div
            className={`relative mx-auto flex aspect-square w-full max-w-[28rem] items-center justify-center overflow-hidden rounded-xl transition-colors ${
              previewUrl
                ? "bg-muted"
                : dragging
                  ? "border-2 border-primary/40 bg-muted"
                  : "border-2 border-dashed border-border bg-muted/35"
            }`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              if (
                !(event.relatedTarget instanceof Node) ||
                !event.currentTarget.contains(event.relatedTarget)
              ) {
                setDragging(false);
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
          >
            {previewUrl ? (
              <>
                <Image
                  alt="Preview of the selected Instant"
                  className="object-contain"
                  fill
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  src={previewUrl}
                  unoptimized
                />
                <button
                  aria-label="Remove selected photo"
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background"
                  onClick={() => {
                    chooseFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                  type="button"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </>
            ) : (
              <div className="grid justify-items-center gap-3 px-5 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-background text-muted-foreground">
                  <ImagePlus aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">Add a photo</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Drag and drop an image here
                  </p>
                </div>
                <Button
                  onClick={() => inputRef.current?.click()}
                  type="button"
                  variant="outline"
                >
                  Choose from device
                </Button>
              </div>
            )}
          </div>
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
            <span>
              {file
                ? `${file.name} · ${formatFileSize(file.size)}`
                : "JPEG, PNG or WebP"}
            </span>
            <span>Up to 10 MB</span>
            {previewUrl && (
              <Button
                className="h-7 px-2 text-xs"
                onClick={() => inputRef.current?.click()}
                type="button"
                variant="ghost"
              >
                Change photo
              </Button>
            )}
          </div>
          <input
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            className="sr-only"
            id="instant-image"
            onChange={onFileChange}
            ref={inputRef}
            type="file"
          />
          {file && !fileIsValid && (
            <p className="text-sm text-destructive" role="alert">
              Choose a JPEG, PNG, or WebP image smaller than 10 MB.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid gap-2">
            <Label htmlFor="instant-caption">Caption</Label>
            <Textarea
              aria-describedby="caption-help caption-count"
              aria-invalid={!captionIsValid}
              className="min-h-28 resize-y"
              id="instant-caption"
              maxLength={100}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Add a few words to your moment..."
              value={caption}
            />
            <div className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span id="caption-help">One line, up to five words</span>
              <span id="caption-count">
                {countWords(caption)}/5 words
              </span>
            </div>
            {!captionIsValid && (
              <p className="text-sm text-destructive" role="alert">
                Keep the caption to one line and no more than five words.
              </p>
            )}
          </div>

          <div className="rounded-xl bg-muted/50 p-4">
            <p className="text-sm font-medium">A moment, not forever</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Shared Instants expire after 36 hours. Your private archive copy
              stays until you delete it.
            </p>
          </div>

          {uploadMessage && (
            <p
              className={`inline-flex items-start gap-2 text-sm ${
                uploadMessage.startsWith("Sharing failed")
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
              role={
                uploadMessage.startsWith("Sharing failed") ? "alert" : "status"
              }
            >
              {uploadMessage.startsWith("Instant shared") && (
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              )}
              {uploadMessage}
            </p>
          )}
          {archiveError && (
            <p className="text-sm text-destructive" role="alert">
              {archiveError}
            </p>
          )}

          <Button
            aria-busy={uploading}
            className="mt-auto h-11 w-full"
            disabled={!fileIsValid || !captionIsValid || uploading}
            type="submit"
          >
            {uploading ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" />
                Sharing your Instant...
              </>
            ) : (
              "Share Instant"
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

function isCaptionValid(value: string): boolean {
  const caption = value.trim();
  return (
    caption.length <= 100 &&
    !/[\r\n]/.test(value) &&
    (caption === "" || countWords(caption) <= 5)
  );
}

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) {
    return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  }
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
