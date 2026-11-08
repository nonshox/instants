import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import {
  getInstantAccount,
  instantServiceError,
  logInstantFailure,
  rejectInstantMutationOrigin,
} from "@/src/features/instants/http";
import { getFeedPage } from "@/src/features/instants/feed";
import {
  MAX_IMAGE_BYTES,
  captionSchema,
  feedCursorSchema,
  localInstantIdSchema,
} from "@/src/features/instants/schemas";
import {
  createInstant,
  InstantConflictError,
  InvalidInstantImageError,
  UnsupportedImageError,
  UnsupportedInstantImageError,
} from "@/src/features/instants/service";

export async function GET(request: Request) {
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view your feed.");
  }

  const rawCursor = new URL(request.url).searchParams.get("cursor");
  const cursor = rawCursor
    ? feedCursorSchema.safeParse(rawCursor)
    : { success: true as const, data: null };
  if (!cursor.success) {
    return jsonError(400, "INVALID_CURSOR", "Feed cursor is invalid.");
  }

  try {
    const page = await getFeedPage(auth.account.$id, cursor.data);
    return NextResponse.json(page, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return instantServiceError(error);
  }
}

export async function POST(request: Request) {
  const originError = rejectInstantMutationOrigin(request);
  if (originError) {
    return originError;
  }
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to share an Instant.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "INVALID_FORM", "Select an image and try again.");
  }

  const files = form.getAll("image");
  const captions = form.getAll("caption");
  const instantIds = form.getAll("localId");
  const image = files[0];
  if (
    files.length !== 1 ||
    captions.length > 1 ||
    instantIds.length !== 1 ||
    !(image instanceof File)
  ) {
    return jsonError(400, "INVALID_FORM", "Select one image and try again.");
  }
  const instantId = localInstantIdSchema.safeParse(instantIds[0]);
  if (!instantId.success) {
    return jsonError(400, "INVALID_INSTANT_ID", "The Instant identifier is invalid.");
  }
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return jsonError(
      413,
      "IMAGE_SIZE_INVALID",
      "That photo can't be uploaded. Try another one.",
    );
  }

  const parsedCaption = captionSchema.safeParse(
    typeof captions[0] === "string" ? captions[0] : "",
  );
  if (!parsedCaption.success) {
    return jsonError(
      400,
      "CAPTION_INVALID",
      "Captions must be one line and no more than five words.",
    );
  }

  try {
    const instant = await createInstant(
      auth.account.$id,
      instantId.data,
      parsedCaption.data,
      Buffer.from(await image.arrayBuffer()),
    );
    return NextResponse.json({ instant }, { status: 201 });
  } catch (error) {
    if (error instanceof InstantConflictError) {
      return jsonError(409, "INSTANT_CONFLICT", error.message);
    }
    if (
      error instanceof UnsupportedInstantImageError ||
      error instanceof InvalidInstantImageError ||
      error instanceof UnsupportedImageError
    ) {
      return jsonError(400, "IMAGE_INVALID", error.message);
    }
    logInstantFailure("Instant upload", error);
    return jsonError(502, "INSTANT_CREATE_FAILED", "Instant could not be shared.");
  }
}
