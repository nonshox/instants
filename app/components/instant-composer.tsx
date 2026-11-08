"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  Check,
  FlipHorizontal2,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ArchivedInstant } from "@/src/features/instants/archive";
import {
  prepareSquareImage,
  SquareImageError,
} from "@/src/features/instants/prepare-image";
import { useInstantStore } from "@/src/features/instants/store";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10_000_000;
const MAX_EXPORT_EDGE = 1440;
const CAPTION_WORD_LIMIT = 5;

export function InstantComposer() {
  const uploading = useInstantStore((state) => state.uploading);
  const archiveError = useInstantStore((state) => state.archiveError);
  const uploadMessage = useInstantStore((state) => state.uploadMessage);
  const shareInstant = useInstantStore((state) => state.upload);
  const retryUpload = useInstantStore((state) => state.retryUpload);
  const clearUploadMessage = useInstantStore(
    (state) => state.clearUploadMessage,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraRequestId = useRef(0);
  const fileRequestId = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(
    null,
  );
  const [caption, setCaption] = useState("");
  const [dragging, setDragging] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraMirrored, setCameraMirrored] = useState(false);
  const [cameraDeviceIds, setCameraDeviceIds] = useState<string[]>([]);
  const [mediaError, setMediaError] = useState("");
  const [failedUpload, setFailedUpload] = useState<ArchivedInstant | null>(
    null,
  );
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!cameraStream || !video) return;

    video.srcObject = cameraStream;
    void video.play().catch(() => {
      setMediaError(
        "The camera preview could not start. Check camera permissions.",
      );
    });

    return () => {
      video.srcObject = null;
      cameraStream.getTracks().forEach((track) => track.stop());
    };
  }, [cameraStream]);

  useEffect(() => () => {
    cameraRequestId.current += 1;
  }, []);

  useEffect(() => {
    if (!cameraStream) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      cameraRequestId.current += 1;
      setCameraStarting(false);
      setCameraStream(null);
      setCameraMirrored(false);
      setMediaError("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cameraStream]);

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

  const resetPhoto = () => {
    setFile(null);
    setCaption("");
    setFailedUpload(null);
    setPreparing(false);
    setMediaError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const chooseFile = async (nextFile: File | null) => {
    if (uploading) return;

    const requestId = ++fileRequestId.current;
    cameraRequestId.current += 1;
    setCameraStarting(false);
    setCameraStream(null);
    setCameraMirrored(false);
    setMediaError("");
    setPreparing(false);
    setFailedUpload(null);
    clearUploadMessage();

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(nextFile.type)) {
      setFile(null);
      setMediaError("Choose a JPEG, PNG, or WebP photo.");
      return;
    }

    if (nextFile.size === 0 || nextFile.size > MAX_IMAGE_BYTES) {
      setFile(null);
      setMediaError("Choose a photo smaller than 10 MB.");
      return;
    }

    setFile(nextFile);
    setPreparing(true);
    try {
      const squareFile = await prepareSquareImage(nextFile);
      if (requestId === fileRequestId.current) {
        setFile(squareFile);
      }
    } catch (cause) {
      if (requestId === fileRequestId.current) {
        setFile(null);
        setMediaError(
          cause instanceof SquareImageError
            ? cause.message
            : "This photo could not be prepared. Choose a different image and try again.",
        );
      }
    } finally {
      if (requestId === fileRequestId.current) {
        setPreparing(false);
      }
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    event.target.value = "";
    void chooseFile(nextFile);
  };

  const openCamera = async () => {
    if (uploading || preparing || cameraStarting) return;

    setMediaError("");
    clearUploadMessage();
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError(
        "Camera access is unavailable in this browser. Choose a photo instead.",
      );
      return;
    }

    const requestId = ++cameraRequestId.current;
    setCameraStarting(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" } },
        });
      } catch (cause) {
        const name = cause instanceof Error ? cause.name : "";
        if (name !== "OverconstrainedError") {
          throw cause;
        }
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true,
        });
      }

      if (requestId !== cameraRequestId.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      let deviceIds: string[] = [];
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        deviceIds = devices
          .filter((device) => device.kind === "videoinput")
          .map((device) => device.deviceId)
          .filter(Boolean);
      } catch {
        deviceIds = [];
      }

      if (requestId !== cameraRequestId.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setCameraDeviceIds(deviceIds);
      setCameraMirrored(isMirroredCamera(stream));
      setCameraStream(stream);
    } catch (cause) {
      if (requestId === cameraRequestId.current) {
        setMediaError(getCameraError(cause));
      }
    } finally {
      if (requestId === cameraRequestId.current) {
        setCameraStarting(false);
      }
    }
  };

  const flipCamera = async () => {
    if (!cameraStream || cameraStarting) return;

    const requestId = ++cameraRequestId.current;
    const currentTrack = cameraStream.getVideoTracks()[0];
    const currentDeviceId = currentTrack?.getSettings().deviceId;
    let devices: MediaDeviceInfo[];
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (cause) {
      setMediaError(getCameraError(cause));
      return;
    }

    const videoDevices = devices.filter(
      (device) => device.kind === "videoinput" && device.deviceId,
    );
    setCameraDeviceIds(videoDevices.map((device) => device.deviceId));

    const currentIndex = videoDevices.findIndex(
      (device) => device.deviceId === currentDeviceId,
    );
    if (videoDevices.length < 2 || currentIndex < 0) {
      setMediaError("A second camera is not available on this device.");
      return;
    }

    setCameraStarting(true);
    setMediaError("");
    try {
      const nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length];
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: nextDevice.deviceId } },
      });
      if (requestId !== cameraRequestId.current) {
        nextStream.getTracks().forEach((track) => track.stop());
        return;
      }
      setCameraMirrored(isMirroredCamera(nextStream));
      setCameraStream(nextStream);
    } catch (cause) {
      if (requestId === cameraRequestId.current) {
        setMediaError(getCameraError(cause));
      }
    } finally {
      if (requestId === cameraRequestId.current) {
        setCameraStarting(false);
      }
    }
  };

  const closeCamera = () => {
    cameraRequestId.current += 1;
    setCameraStarting(false);
    setCameraStream(null);
    setCameraMirrored(false);
    setMediaError("");
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setMediaError("The camera is not ready yet. Please try again.");
      return;
    }

    // Match the square crop shown by the live preview so the shot is 1:1.
    const side = Math.min(video.videoWidth, video.videoHeight);
    const outputEdge = Math.min(side, MAX_EXPORT_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = outputEdge;
    canvas.height = outputEdge;
    const context = canvas.getContext("2d");
    if (!context) {
      setMediaError("The photo could not be captured. Please try again.");
      return;
    }

    if (cameraMirrored) {
      context.translate(outputEdge, 0);
      context.scale(-1, 1);
    }
    context.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      outputEdge,
      outputEdge,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob || blob.size > MAX_IMAGE_BYTES) {
      setMediaError(
        blob
          ? "This photo is larger than 10 MB. Try moving closer or use a smaller image."
          : "The photo could not be captured. Please try again.",
      );
      return;
    }

    await chooseFile(
      new File([blob], `instant-${Date.now()}.jpg`, { type: blob.type }),
    );
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (uploading || preparing) return;
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) void chooseFile(droppedFile);
  };

  const onPaste = (event: ClipboardEvent<HTMLFormElement>) => {
    if (uploading || preparing) return;
    const pastedFile =
      Array.from(event.clipboardData.files)[0] ??
      Array.from(event.clipboardData.items)
        .find((item) => item.kind === "file")
        ?.getAsFile();
    if (!pastedFile) return;
    event.preventDefault();
    void chooseFile(pastedFile);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !file ||
      !fileIsValid ||
      !captionIsValid ||
      uploading ||
      preparing ||
      cameraStream ||
      cameraStarting
    ) {
      return;
    }

    setFailedUpload(null);
    const result = await shareInstant(file, caption);
    if (!result) return;

    if (result.syncState === "uploaded") {
      resetPhoto();
    } else if (result.syncState === "failed") {
      setFailedUpload(result);
    }
  };

  const retryFailedUpload = async () => {
    if (!failedUpload || retrying || uploading) return;

    setRetrying(true);
    try {
      await retryUpload(failedUpload);
      const current = useInstantStore
        .getState()
        .archive.find((item) => item.localId === failedUpload.localId);
      if (current?.syncState === "uploaded") {
        resetPhoto();
      }
    } finally {
      setRetrying(false);
    }
  };

  const fileIsValid = Boolean(
    !preparing &&
      file &&
      file.size > 0 &&
      file.size <= MAX_IMAGE_BYTES &&
      ACCEPTED_IMAGE_TYPES.includes(file.type),
  );
  const captionIsValid = isCaptionValid(caption);
  const previewUrl = preview?.file === file ? preview.url : "";
  const uploadFailed = Boolean(failedUpload);
  const uploadSucceeded =
    !uploadFailed && uploadMessage.startsWith("Instant shared");
  const canShare =
    fileIsValid &&
    captionIsValid &&
    !uploading &&
    !preparing &&
    !cameraStream &&
    !cameraStarting;

  return (
    <section
      aria-labelledby="create-instant-title"
      className="mx-auto w-full max-w-[430px]"
    >
      <header className="mb-4">
        <h1
          className="text-xl font-semibold tracking-tight"
          id="create-instant-title"
        >
          New Instant
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share a quick moment with your links.
        </p>
      </header>

      <form
        aria-busy={uploading}
        className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
        onPaste={onPaste}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div
          className={`relative isolate aspect-square w-full overflow-hidden transition-colors ${
            dragging ? "bg-primary/5" : "bg-muted/50"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!Array.from(event.dataTransfer.types).includes("Files")) return;
            if (!uploading && !preparing) setDragging(true);
          }}
          onDragLeave={(event) => {
            if (
              !(event.relatedTarget instanceof Node) ||
              !event.currentTarget.contains(event.relatedTarget)
            ) {
              setDragging(false);
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!Array.from(event.dataTransfer.types).includes("Files")) return;
            if (!uploading && !preparing) setDragging(true);
          }}
          onDrop={onDrop}
        >
          {cameraStream ? (
            <>
              <video
                aria-label="Live camera preview"
                autoPlay
                className={`size-full object-cover ${
                  cameraMirrored ? "-scale-x-100" : ""
                }`}
                muted
                playsInline
                ref={videoRef}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/40 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent"
              />
              {cameraDeviceIds.length > 1 && (
                <Button
                  aria-label="Switch camera"
                  className="absolute left-3 top-3 z-10 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 hover:text-white"
                  disabled={cameraStarting}
                  onClick={() => void flipCamera()}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  {cameraStarting ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="animate-spin"
                    />
                  ) : (
                    <FlipHorizontal2 aria-hidden="true" />
                  )}
                </Button>
              )}
              <button
                aria-label="Close camera"
                className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={closeCamera}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
              <button
                aria-label="Take photo"
                className="absolute bottom-5 left-1/2 z-10 grid size-14 -translate-x-1/2 place-items-center rounded-full border-[3px] border-white/90 bg-white/20 backdrop-blur-sm transition active:scale-95 disabled:opacity-50"
                disabled={cameraStarting || uploading}
                onClick={() => void capturePhoto()}
                type="button"
              >
                <span className="size-10 rounded-full bg-white" />
              </button>
            </>
          ) : previewUrl && !cameraStarting ? (
            <>
              <Image
                alt="Preview of the selected Instant"
                className="object-cover"
                fill
                sizes="(max-width: 430px) 100vw, 430px"
                src={previewUrl}
                unoptimized
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent"
              />
              <button
                aria-label="Remove selected photo"
                className="absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                onClick={() => void chooseFile(null)}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
              <div className="absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2">
                <Button
                  className="rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
                  disabled={uploading || preparing}
                  onClick={() => inputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <ImagePlus aria-hidden="true" />
                  Change
                </Button>
                <Button
                  className="rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur-sm hover:bg-background"
                  disabled={uploading || preparing}
                  onClick={() => void openCamera()}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Camera aria-hidden="true" />
                  Camera
                </Button>
              </div>
            </>
          ) : cameraStarting ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="grid justify-items-center gap-3">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-6 animate-spin text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  Starting camera...
                </p>
                <Button
                  onClick={closeCamera}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-3 rounded-xl border-2 border-dashed transition-colors ${
                  dragging ? "border-primary/60" : "border-border"
                }`}
              />
              <div className="relative grid h-full place-items-center px-6 text-center">
                <div className="grid justify-items-center gap-4">
                  <span className="grid size-14 place-items-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border/60">
                    <ImagePlus aria-hidden="true" className="size-6" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Add a photo</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Square 1:1 · JPEG, PNG or WebP · up to 10 MB
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      className="rounded-full"
                      disabled={uploading || preparing}
                      onClick={() => inputRef.current?.click()}
                      size="sm"
                      type="button"
                    >
                      <ImagePlus aria-hidden="true" />
                      Choose photo
                    </Button>
                    <Button
                      className="rounded-full"
                      disabled={uploading || preparing}
                      onClick={() => void openCamera()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Camera aria-hidden="true" />
                      Camera
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {dragging && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-background/85 px-6 text-center backdrop-blur-sm"
            >
              <div className="grid justify-items-center gap-2">
                <ImagePlus className="size-6" />
                <p className="text-sm font-medium">Drop your photo</p>
                <p className="text-xs text-muted-foreground">
                  It will be cropped to a square
                </p>
              </div>
            </div>
          )}

          {preparing && (
            <div
              aria-live="polite"
              className="absolute inset-0 z-20 grid place-items-center bg-background/65 backdrop-blur-[1px]"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs font-medium shadow-sm ring-1 ring-border/60">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                Cropping to square
              </span>
            </div>
          )}

          {uploading && (
            <div
              aria-live="polite"
              className="absolute inset-0 z-20 grid place-items-center bg-background/75 backdrop-blur-[2px]"
              role="status"
            >
              <div className="grid justify-items-center gap-2 text-center">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-6 animate-spin"
                />
                <p className="text-sm font-medium">Sharing...</p>
                <p className="text-xs text-muted-foreground">
                  Saving to your private archive first
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 p-3.5">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label
                className="text-xs font-medium text-muted-foreground"
                htmlFor="instant-caption"
              >
                Caption
              </Label>
              <span
                className={`text-[11px] tabular-nums ${
                  captionIsValid
                    ? "text-muted-foreground"
                    : "text-destructive"
                }`}
                id="caption-count"
              >
                {countWords(caption)}/{CAPTION_WORD_LIMIT}
              </span>
            </div>
            <Textarea
              aria-describedby="caption-count"
              aria-invalid={!captionIsValid}
              className="min-h-16 resize-none border-transparent bg-muted/50 px-3 py-2.5 text-sm"
              id="instant-caption"
              maxLength={100}
              onChange={(event) =>
                setCaption(event.target.value.replace(/[\r\n]+/g, " "))
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !(event.metaKey || event.ctrlKey)
                ) {
                  event.preventDefault();
                }
              }}
              placeholder="Write a few words..."
              rows={2}
              value={caption}
            />
            {!captionIsValid && (
              <p className="text-xs text-destructive" role="alert">
                Keep it to one line and five words or fewer.
              </p>
            )}
          </div>

          {mediaError && (
            <p className="text-xs text-destructive" role="alert">
              {mediaError}
            </p>
          )}
          {archiveError && (
            <p className="text-xs text-destructive" role="alert">
              {archiveError}
            </p>
          )}

          {(uploadMessage || failedUpload) && (
            <div
              className="grid gap-2"
              role={uploadFailed && !retrying ? "alert" : "status"}
            >
              {uploadMessage ? (
                <p
                  className={`flex items-start gap-2 text-xs ${
                    uploadFailed
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {uploadSucceeded && (
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                  )}
                  <span>{uploadMessage}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Retrying from your archive...
                </p>
              )}
              <div className="flex items-center gap-3">
                {uploadFailed && (
                  <Button
                    disabled={retrying || uploading}
                    onClick={() => void retryFailedUpload()}
                    size="xs"
                    type="button"
                    variant="outline"
                  >
                    {retrying ? (
                      <>
                        <LoaderCircle
                          aria-hidden="true"
                          className="animate-spin"
                        />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw aria-hidden="true" />
                        Try again
                      </>
                    )}
                  </Button>
                )}
                {uploadSucceeded && (
                  <Link
                    className="text-xs font-medium underline underline-offset-4"
                    href="/"
                  >
                    View feed
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-3.5 py-3">
          <p className="text-[11px] leading-tight text-muted-foreground">
            Private archive copy
            <span aria-hidden="true" className="mx-1 text-border">
              ·
            </span>
            Expires in 36 h
          </p>
          <Button
            aria-busy={uploading}
            className="h-9 min-w-24 rounded-full px-5"
            disabled={!canShare}
            size="lg"
            type="submit"
          >
            {uploading ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" />
                Sharing
              </>
            ) : (
              "Share"
            )}
          </Button>
        </div>
      </form>

      <input
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        aria-label="Upload a photo"
        className="sr-only"
        onChange={onFileChange}
        ref={inputRef}
        type="file"
      />
    </section>
  );
}

function isCaptionValid(value: string): boolean {
  const caption = value.trim();
  return (
    caption.length <= 100 &&
    !/[\r\n]/.test(value) &&
    (caption === "" || countWords(caption) <= CAPTION_WORD_LIMIT)
  );
}

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function isMirroredCamera(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0];
  return track?.getSettings().facingMode === "user";
}

function getCameraError(cause: unknown): string {
  if (cause instanceof DOMException) {
    if (cause.name === "NotAllowedError" || cause.name === "SecurityError") {
      return "Allow camera access for this site in your browser settings, then try again.";
    }
    if (cause.name === "NotFoundError") {
      return "No camera was found. Choose a photo from your device instead.";
    }
    if (cause.name === "NotReadableError") {
      return "The camera could not be opened. Check that it is connected and not in use by another app.";
    }
  }
  return "The camera could not be opened. Check your browser permissions and try again.";
}
