import { NextResponse } from "next/server";
import {
  getInstantAccount,
  logInstantFailure,
  rejectInstantMutationOrigin,
  instantServiceError,
} from "@/src/features/instants/http";
import { instantIdSchema } from "@/src/features/instants/schemas";
import { setInstantLike } from "@/src/features/instants/likes";
import { InstantNotFoundError } from "@/src/features/instants/service";
import { jsonError } from "@/src/features/auth/http";

type RouteContext = { params: Promise<{ instantId: string }> };

export const maxDuration = 30;

export async function PUT(request: Request, context: RouteContext) {
  return updateLike(request, context, true);
}

export async function DELETE(request: Request, context: RouteContext) {
  return updateLike(request, context, false);
}

async function updateLike(
  request: Request,
  context: RouteContext,
  liked: boolean,
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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to like Instants.");
  }

  const { instantId } = await context.params;
  if (!instantIdSchema.safeParse(instantId).success) {
    return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
  }

  try {
    const result = await setInstantLike(auth.account.$id, instantId, liked);
    return NextResponse.json({ like: result });
  } catch (error) {
    if (error instanceof InstantNotFoundError) {
      return instantServiceError(error);
    }
    logInstantFailure("Instant like", error);
    return jsonError(502, "LIKE_UNAVAILABLE", "The like could not be updated.");
  }
}
