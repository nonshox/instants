"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  Check,
  Eye,
  FlipHorizontal2,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { fetchProfile, type Profile } from "@/src/features/profile/client-api";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import type { ArchivedInstant } from "@/src/features/instants/archive";
import {
  prepareSquareImage,
  SquareImageError,
} from "@/src/features/instants/prepare-image";
import { useInstantStore } from "@/src/features/instants/store";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10_000_000;
const MAX_EXPORT_EDGE = 1440;
const CAPTION_MAX = 60;

export function InstantComposer() {
  const uploading = useInstantStore((state) => state.uploading);
  const uploadProgress = useInstantStore((state) => state.uploadProgress);
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
  const autoStarted = useRef(false);
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [previewAsFriend, setPreviewAsFriend] = useState(false);

  useEffect(() => {
    let active = true;
    fetchProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        // Preview falls back to initials when profile is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

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

  const openCamera = useCallback(async () => {
    if (uploading || preparing || cameraStarting || cameraStream) return;

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

      // Show the preview as soon as the camera is live; device enumeration
      // happens in the background.
      setCameraMirrored(isMirroredCamera(stream));
      setCameraStream(stream);

      void navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          if (requestId === cameraRequestId.current) {
            setCameraDeviceIds(
              devices
                .filter((device) => device.kind === "videoinput")
                .map((device) => device.deviceId)
                .filter(Boolean),
            );
          }
        })
        .catch(() => setCameraDeviceIds([]));
    } catch (cause) {
      if (requestId === cameraRequestId.current) {
        setMediaError(getCameraError(cause));
      }
    } finally {
      if (requestId === cameraRequestId.current) {
        setCameraStarting(false);
      }
    }
  }, [uploading, preparing, cameraStarting, cameraStream, clearUploadMessage]);

  // Camera turns on automatically when the page opens.
  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    void openCamera();
  }, [openCamera]);

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
      setMediaError("That photo can't be used. Try another one.");
      return;
    }

    if (nextFile.size === 0 || nextFile.size > MAX_IMAGE_BYTES) {
      setFile(null);
      setMediaError("That photo can't be used. Try another one.");
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

  const flipCamera = async () => {
    if (!cameraStream || cameraStarting) return;

    const requestId = ++cameraRequestId.current;
    const currentTrack = cameraStream.getVideoTracks()[0];
    const currentFacing = currentTrack?.getSettings().facingMode;
    const currentDeviceId = currentTrack?.getSettings().deviceId ?? "";
    const targetFacing = currentFacing === "environment" ? "user" : "environment";

    setCameraStarting(true);
    setMediaError("");

    // Prefer switching camera role (front/back) — reliable on phones.
    const candidates: MediaTrackConstraints[] = [
      { facingMode: { exact: targetFacing } },
      { facingMode: { ideal: targetFacing } },
    ];

    // Fall back to picking a different physical device when facingMode is
    // unsupported or ambiguous (deviceId from getSettings is often empty).
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput" && device.deviceId,
      );
      setCameraDeviceIds(videoDevices.map((device) => device.deviceId));
      const other = videoDevices.find(
        (device) => device.deviceId !== currentDeviceId,
      );
      if (other) {
        candidates.push({ deviceId: { exact: other.deviceId } });
        candidates.push({ deviceId: { ideal: other.deviceId } });
      }
    } catch {
      // Enumeration failing is fine — the facingMode candidates still apply.
    }

    let nextStream: MediaStream | null = null;
    for (const video of candidates) {
      try {
        nextStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video,
        });
        break;
      } catch {
        // Try the next constraint.
      }
    }

    if (!nextStream) {
      if (requestId === cameraRequestId.current) {
        setMediaError("A second camera is not available on this device.");
        setCameraStarting(false);
      }
      return;
    }
    if (requestId !== cameraRequestId.current) {
      nextStream.getTracks().forEach((track) => track.stop());
      return;
    }

    // Swap only once the new stream works; the old one keeps running otherwise.
    setCameraMirrored(isMirroredCamera(nextStream));
    setCameraStream(nextStream);
    setCameraStarting(false);
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
        "The photo could not be captured. Try moving a little closer and try again.",
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
      className="mx-auto w-full max-w-[350px]"
    >
      <h1
        className="mb-4 text-center text-lg font-semibold tracking-tight"
        id="create-instant-title"
      >
        New Instant
      </h1>

      <form
        aria-busy={uploading}
        className="relative"
        id="instant-composer-form"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }
        }}
        onPaste={onPaste}
        onSubmit={(event) => void handleSubmit(event)}
      >
        {/* Beauty frame */}
        <div
          className={`relative isolate aspect-square w-full overflow-hidden rounded-[2rem] bg-muted/50 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.35)] ring-1 ring-border/70 transition-colors ${
            dragging ? "bg-primary/5" : ""
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
              {cameraDeviceIds.length !== 1 && (
                <button
                  aria-label="Switch camera"
                  className="absolute left-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-black/40 text-white outline-none backdrop-blur-sm transition hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white"
                  disabled={cameraStarting}
                  onClick={() => void flipCamera()}
                  type="button"
                >
                  {cameraStarting ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-5 animate-spin"
                    />
                  ) : (
                    <FlipHorizontal2 aria-hidden="true" className="size-5" />
                  )}
                </button>
              )}
              <button
                aria-label="Close camera"
                className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-black/40 text-white outline-none backdrop-blur-sm transition hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white"
                onClick={closeCamera}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
              <button
                aria-label="Take photo"
                className="absolute bottom-6 left-1/2 z-10 grid size-16 -translate-x-1/2 place-items-center rounded-full border-[3px] border-white/90 bg-white/15 outline-none backdrop-blur-sm transition active:scale-95 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                disabled={cameraStarting || uploading}
                onClick={() => void capturePhoto()}
                type="button"
              >
                <span className="size-12 rounded-full bg-white" />
              </button>
            </>
          ) : previewUrl && !cameraStarting ? (
            <>
              <Image
                alt="Preview of the selected Instant"
                className="object-cover"
                fill
                sizes="430px"
                src={previewUrl}
                unoptimized
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent"
              />
              <button
                aria-label="Remove photo"
                className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-black/40 text-white outline-none backdrop-blur-sm transition hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white"
                onClick={() => void chooseFile(null)}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
              <button
                aria-label={previewAsFriend ? "Exit preview" : "Preview as your followers will see it"}
                aria-pressed={previewAsFriend}
                className="absolute left-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-black/40 text-white outline-none backdrop-blur-sm transition hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white"
                onClick={() => setPreviewAsFriend((value) => !value)}
                type="button"
              >
                <Eye aria-hidden="true" className="size-5" />
              </button>
              {previewAsFriend && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-4 bottom-4 z-20 flex flex-col items-center gap-1.5 text-center"
                >
                  <span className="font-semibold text-sm text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                    @{profile?.username ?? "you"}
                  </span>
                  {caption && (
                    <span className="max-w-[80%] truncate text-[11px] text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                      {caption}
                    </span>
                  )}
                  <span className="mt-1 text-base drop-shadow-[0_1px_3px_rgba(0,0,0,0.7)]">
                    ❤️ 🔥 😍 👏 🙌
                  </span>
                </div>
              )}
              <div
                className={`absolute inset-x-4 bottom-4 z-10 flex items-center justify-between ${
                  previewAsFriend ? "opacity-0" : ""
                }`}
              >
                <button
                  aria-label="Choose a different photo"
                  className="grid size-11 place-items-center rounded-full bg-black/40 text-white outline-none backdrop-blur-sm transition hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                  disabled={uploading || preparing}
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  <ImagePlus aria-hidden="true" className="size-5" />
                </button>
                <button
                  aria-label="Use the camera"
                  className="grid size-11 place-items-center rounded-full bg-black/40 text-white outline-none backdrop-blur-sm transition hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
                  disabled={uploading || preparing}
                  onClick={() => void openCamera()}
                  type="button"
                >
                  <Camera aria-hidden="true" className="size-5" />
                </button>
              </div>
            </>
          ) : cameraStarting ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="grid justify-items-center gap-3">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-6 animate-spin text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Starting camera...</p>
                <p className="max-w-52 text-[10px] leading-4 text-muted-foreground/70">
                  Your browser may ask for camera permission.
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
                className={`pointer-events-none absolute inset-4 rounded-[1.5rem] border-2 border-dashed transition-colors ${
                  dragging ? "border-primary/60" : "border-border"
                }`}
              />
              <div className="relative grid h-full place-items-center px-6 text-center">
                <div className="grid justify-items-center gap-5">
                  <span className="grid size-16 place-items-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border/60">
                    <ImagePlus aria-hidden="true" className="size-7" />
                  </span>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      aria-label="Choose a photo"
                      className="grid size-12 place-items-center rounded-full bg-foreground text-background outline-none transition hover:bg-foreground/85 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      disabled={uploading || preparing}
                      onClick={() => inputRef.current?.click()}
                      type="button"
                    >
                      <ImagePlus aria-hidden="true" className="size-5" />
                    </button>
                    <button
                      aria-label="Open the camera"
                      className="grid size-12 place-items-center rounded-full bg-background text-foreground outline-none ring-1 ring-border/70 transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      disabled={uploading || preparing}
                      onClick={() => void openCamera()}
                      type="button"
                    >
                      <Camera aria-hidden="true" className="size-5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {dragging && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-background/85 backdrop-blur-sm"
            >
              <div className="grid justify-items-center gap-2">
                <ImagePlus className="size-7" />
                <p className="text-sm font-medium">Drop your photo</p>
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
                Preparing...
              </span>
            </div>
          )}

          {uploading && (
            <div
              aria-live="polite"
              className="absolute inset-0 z-20 grid place-items-center bg-background/75 backdrop-blur-[2px]"
              role="status"
            >
              <div className="grid w-full max-w-[240px] justify-items-center gap-2 text-center">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-6 animate-spin"
                />
                <p className="text-sm font-medium">
                  Sharing... {uploadProgress > 0 ? `${uploadProgress}%` : ""}
                </p>
                <div
                  aria-hidden="true"
                  className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15"
                >
                  <div
                    className="h-full rounded-full bg-foreground transition-[width] duration-150 ease-out"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Caption pill — curved, sitting on the frame's bottom border */}
        <div className="pointer-events-none absolute inset-x-4 -bottom-5 z-10">
          <div className="pointer-events-auto flex h-11 items-center gap-2 rounded-full border border-border/70 bg-background/95 pl-5 pr-4 shadow-lg shadow-black/10 backdrop-blur-md ring-1 ring-black/5 transition focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring">
            <input
              aria-label="Caption"
              aria-invalid={!captionIsValid}
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              id="instant-caption"
              maxLength={CAPTION_MAX}
              onChange={(event) =>
                setCaption(event.target.value.replace(/[\r\n]+/g, " "))
              }
              placeholder="Caption this moment..."
              value={caption}
            />
            <span
              aria-hidden="true"
              className="shrink-0 text-[10px] font-medium tabular-nums text-muted-foreground"
            >
              {caption.length}/{CAPTION_MAX}
            </span>
          </div>
        </div>
      </form>

      {/* Actions */}
      <div className="mt-9 px-0.5">
        {mediaError ? (
          <p className="mb-2 text-xs leading-5 text-destructive" role="alert">
            {mediaError}
          </p>
        ) : archiveError ? (
          <p className="mb-2 text-xs leading-5 text-destructive" role="alert">
            {archiveError}
          </p>
        ) : null}
        <Button
          aria-busy={uploading}
          className="h-12 w-full rounded-full text-sm font-semibold shadow-[0_10px_26px_-8px_rgba(0,0,0,0.35)]"
          disabled={!canShare}
          form="instant-composer-form"
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

      {(uploadMessage || failedUpload) && (
        <div
          className="mt-2 grid gap-2 px-1"
          role={uploadFailed && !retrying ? "alert" : "status"}
        >
          {uploadMessage ? (
            <p
              className={`flex items-start gap-2 text-xs ${
                uploadFailed ? "text-destructive" : "text-muted-foreground"
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

      <input
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        aria-label="Choose a photo"
        className="sr-only"
        onChange={onFileChange}
        ref={inputRef}
        type="file"
      />
    </section>
  );
}

function isCaptionValid(value: string): boolean {
  return value.length <= CAPTION_MAX && !/[\r\n]/.test(value);
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
