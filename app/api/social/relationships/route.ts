import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import {
  getSocialAccount,
  parseSocialInput,
  rejectForeignOrigin,
  socialFailure,
} from "@/src/features/social/http";
import {
  followByUsername,
  removeRelationship,
} from "@/src/features/social/service";
import { relationshipInputSchema } from "@/src/features/social/schemas";

export const maxDuration = 30;

export async function POST(request: Request) {
  const originError = rejectForeignOrigin(request);
  if (originError) {
    return originError;
  }
  const auth = await getSocialAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to follow accounts.");
  }
  const parsed = await parseSocialInput(request, relationshipInputSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const relationship = await followByUsername(
      auth.account.$id,
      parsed.data.username,
    );
    return NextResponse.json({ relationship });
  } catch (error) {
    return socialFailure("Follow action", error);
  }
}

export async function DELETE(request: Request) {
  const originError = rejectForeignOrigin(request);
  if (originError) {
    return originError;
  }
  const auth = await getSocialAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to unfollow accounts.");
  }
  const parsed = relationshipInputSchema.safeParse({
    username: new URL(request.url).searchParams.get("username"),
  });
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Enter a valid username.");
  }

  try {
    await removeRelationship(auth.account.$id, parsed.data.username);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return socialFailure("Unfollow action", error);
  }
}
