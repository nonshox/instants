import { NextResponse } from "next/server";
import {
  getInstantAccount,
  logInstantFailure,
  rejectInstantMutationOrigin,
} from "@/src/features/instants/http";
import { instantIdSchema } from "@/src/features/instants/schemas";
import {
  listViewersOfInstant,
  recordView,
} from "@/src/features/instants/views";
import { jsonError } from "@/src/features/auth/http";

type RouteContext = { params: Promise<{ instantId: string }> };

export const maxDuration = 30;

export async function POST(request: Request, context: RouteContext) {
  const originError = rejectInstantMutationOrigin(request);
  if (originError) {
    return originError;
  }
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view Instants.");
  }

  const { instantId } = await context.params;
  if (!instantIdSchema.safeParse(instantId).success) {
    return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
  }

  try {
    const result = await recordView(auth.account.$id, instantId);
    return NextResponse.json(result);
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "InstantNotFoundError") {
      return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
    }
    logInstantFailure("Instant view", error);
    return jsonError(502, "VIEW_UNAVAILABLE", "The view could not be recorded.");
  }
}

/** Owner-only: who has dealt or reacted to one of their Instants. */
export async function GET(request: Request, context: RouteContext) {
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to see views.");
  }

  const { instantId } = await context.params;
  if (!instantIdSchema.safeParse(instantId).success) {
    return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
  }

  try {
    const viewers = await listViewersOfInstant(instantId, auth.account.$id);
    return NextResponse.json(
      { viewers },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "InstantNotFoundError") {
      return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
    }
    logInstantFailure("Instant viewers", error);
    return jsonError(502, "VIEWS_UNAVAILABLE", "Views could not be loaded.");
  }
}
