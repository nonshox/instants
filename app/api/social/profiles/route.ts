import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import { getSocialAccount, socialFailure } from "@/src/features/social/http";
import { getProfileForViewer } from "@/src/features/social/service";
import { profileLookupSchema } from "@/src/features/social/schemas";

export async function GET(request: Request) {
  const auth = await getSocialAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to find accounts.");
  }

  const parsed = profileLookupSchema.safeParse({
    username: new URL(request.url).searchParams.get("username"),
  });
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Enter a valid username.");
  }

  try {
    const profile = await getProfileForViewer(
      auth.account.$id,
      parsed.data.username,
    );
    return NextResponse.json({ profile });
  } catch (error) {
    return socialFailure("Profile lookup", error);
  }
}
