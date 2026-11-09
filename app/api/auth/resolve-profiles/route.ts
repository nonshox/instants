import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getInstantAccount,
  logInstantFailure,
} from "@/src/features/instants/http";
import { resolveProfiles } from "@/src/features/social/resolve";
import { jsonError } from "@/src/features/auth/http";

export const maxDuration = 30;

const bodySchema = z.object({
  ids: z.array(z.string().min(1).max(36)).max(100),
});

/**
 * Resolves local engagement ids to current public identities — only for the
 * requester and ids the requester is linked with. Everyone else resolves to
 * a privacy blank.
 */
export async function POST(request: Request) {
  const auth = await getInstantAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in first.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "IDS_INVALID", "Send a list of ids.");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "IDS_INVALID", "Send a list of ids.");
  }

  try {
    const profiles = await resolveProfiles(auth.account.$id, parsed.data.ids);
    return NextResponse.json(
      { profiles },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    logInstantFailure("Profile resolve", error);
    return jsonError(502, "RESOLVE_UNAVAILABLE", "Profiles could not be resolved.");
  }
}
