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
} from "@/src/features/social/service";
import { requestDecisionSchema } from "@/src/features/social/schemas";

export const maxDuration = 30;

export async function GET() {
  const auth = await getSocialAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view requests.");
  }

  try {
    const requests = await listIncomingRequests(auth.account.$id);
    return NextResponse.json({ requests });
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
