import { NextResponse } from "next/server";
import {
  getInstantAccount,
  logInstantFailure,
} from "@/src/features/instants/http";
import { getOwnEngagement } from "@/src/features/instants/engagement";
import { jsonError } from "@/src/features/auth/http";

export const maxDuration = 30;

/** Snapshot of the owner's own Instants with full engagement data. */
export async function GET() {
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to see your Instants.");
  }

  try {
    const instants = await getOwnEngagement(auth.account.$id);
    return NextResponse.json(
      { instants },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    logInstantFailure("Own Instants engagement", error);
    return jsonError(502, "ENGAGEMENT_UNAVAILABLE", "Could not load your Instants.");
  }
}
