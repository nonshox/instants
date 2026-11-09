import { NextResponse } from "next/server";
import {
  getInstantAccount,
  logInstantFailure,
  rejectInstantMutationOrigin,
} from "@/src/features/instants/http";
import { instantIdSchema, reactionEmojiSchema } from "@/src/features/instants/schemas";
import { setInstantReaction } from "@/src/features/instants/likes";
import { jsonError } from "@/src/features/auth/http";

type RouteContext = { params: Promise<{ instantId: string }> };

export const maxDuration = 30;

// Class identity can drift across hot-reload module instances, so match
// these by error name instead of instanceof.
function isInvalidReactionError(error: unknown): boolean {
  return error instanceof Error && error.name === "InvalidReactionError";
}

function isInstantUnavailableError(error: unknown): boolean {
  return error instanceof Error && error.name === "InstantNotFoundError";
}

export async function PUT(request: Request, context: RouteContext) {
  const originError = rejectInstantMutationOrigin(request);
  if (originError) {
    return originError;
  }
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to react to Instants.");
  }

  const { instantId } = await context.params;
  if (!instantIdSchema.safeParse(instantId).success) {
    return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "REACTION_INVALID", "Send an emoji to react with.");
  }
  const parsed = reactionEmojiSchema.safeParse((body as { emoji?: unknown })?.emoji);
  if (!parsed.success) {
    return jsonError(400, "REACTION_INVALID", "That reaction is not supported.");
  }

  try {
    const result = await setInstantReaction(
      auth.account.$id,
      instantId,
      parsed.data,
    );
    return NextResponse.json({ reaction: result });
  } catch (error) {
    if (isInstantUnavailableError(error)) {
      return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
    }
    if (isInvalidReactionError(error)) {
      return jsonError(400, "REACTION_INVALID", "That reaction is not supported.");
    }
    logInstantFailure("Instant reaction", error);
    return jsonError(502, "REACTION_UNAVAILABLE", "The reaction could not be updated.");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const originError = rejectInstantMutationOrigin(request);
  if (originError) {
    return originError;
  }
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to react to Instants.");
  }

  const { instantId } = await context.params;
  if (!instantIdSchema.safeParse(instantId).success) {
    return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
  }

  try {
    const result = await setInstantReaction(auth.account.$id, instantId, null);
    return NextResponse.json({ reaction: result });
  } catch (error) {
    if (isInstantUnavailableError(error)) {
      return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
    }
    logInstantFailure("Instant reaction removal", error);
    return jsonError(502, "REACTION_UNAVAILABLE", "The reaction could not be removed.");
  }
}
