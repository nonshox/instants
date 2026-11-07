import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import {
  getSocialAccount,
  parseSocialInput,
  rejectForeignOrigin,
  socialFailure,
} from "@/src/features/social/http";
import {
  decideIncomingRequest,
  listIncomingRequests,
  listOutgoingRequests,
} from "@/src/features/social/service";
import {
  requestDecisionSchema,
  requestListSchema,
} from "@/src/features/social/schemas";

export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = await getSocialAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view requests.");
  }

  const params = new URL(request.url).searchParams;
  const parsed = requestListSchema.safeParse({
    direction: params.get("direction") ?? "received",
    cursor: params.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Choose a valid request list.");
  }

  try {
    const page = parsed.data.direction === "sent"
      ? await listOutgoingRequests(
          auth.account.$id,
          parsed.data.cursor ?? null,
        )
      : await listIncomingRequests(
          auth.account.$id,
          parsed.data.cursor ?? null,
        );
    return NextResponse.json(page);
  } catch (error) {
    return socialFailure("Incoming requests lookup", error);
  }
}

export async function PATCH(request: Request) {
  const originError = rejectForeignOrigin(request);
  if (originError) {
    return originError;
  }
  const auth = await getSocialAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to manage requests.");
  }
  const parsed = await parseSocialInput(request, requestDecisionSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    await decideIncomingRequest(
      auth.account.$id,
      parsed.data.username,
      parsed.data.action,
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    return socialFailure("Follow request decision", error);
  }
}
