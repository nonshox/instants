import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import { getInstantAccount, instantServiceError, logInstantFailure, rejectInstantMutationOrigin } from "@/src/features/instants/http";
import { captionSchema, instantIdSchema } from "@/src/features/instants/schemas";
import {
  deleteOwnedInstant,
  InstantNotFoundError,
  updateOwnedInstantCaption,
} from "@/src/features/instants/service";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ instantId: string }> },
) {
  const originError = rejectInstantMutationOrigin(request);
  if (originError) {
    return originError;
  }
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to delete an Instant.");
  }

  const { instantId } = await context.params;
  if (!instantIdSchema.safeParse(instantId).success) {
    return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
  }

  try {
    await deleteOwnedInstant(auth.account.$id, instantId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof InstantNotFoundError) {
      return instantServiceError(error);
    }
    logInstantFailure("Instant deletion", error);
    return jsonError(502, "INSTANT_DELETE_FAILED", "Instant could not be deleted.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ instantId: string }> },
) {
  const originError = rejectInstantMutationOrigin(request);
  if (originError) {
    return originError;
  }
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to edit an Instant.");
  }

  const { instantId } = await context.params;
  if (!instantIdSchema.safeParse(instantId).success) {
    return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = captionSchema.safeParse(
    typeof body === "object" && body !== null && "caption" in body
      ? (body as { caption: unknown }).caption
      : undefined,
  );
  if (!parsed.success) {
    return jsonError(
      400,
      "CAPTION_INVALID",
      "Captions must be one line and no more than five words.",
    );
  }

  try {
    const instant = await updateOwnedInstantCaption(
      auth.account.$id,
      instantId,
      parsed.data,
    );
    return NextResponse.json({ instant });
  } catch (error) {
    if (error instanceof InstantNotFoundError) {
      return instantServiceError(error);
    }
    logInstantFailure("Instant caption update", error);
    return jsonError(502, "INSTANT_UPDATE_FAILED", "Caption could not be saved.");
  }
}
