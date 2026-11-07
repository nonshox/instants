import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import {
  getSocialAccount,
  parseSocialInput,
  rejectForeignOrigin,
  socialFailure,
} from "@/src/features/social/http";
import {
  listConnections,
  followByUsername,
  removeFollower,
  removeRelationship,
} from "@/src/features/social/service";
import {
  connectionListSchema,
  relationshipInputSchema,
} from "@/src/features/social/schemas";

export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = await getSocialAccount();
  if ("response" in auth) return auth.response;
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view connections.");
  }
  const params = new URL(request.url).searchParams;
  const parsed = connectionListSchema.safeParse({
    kind: params.get("kind"),
    cursor: params.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Choose a valid connection list.");
  }
  try {
    return NextResponse.json(
      await listConnections(
        auth.account.$id,
        parsed.data.kind,
        parsed.data.cursor ?? null,
      ),
    );
  } catch (error) {
    return socialFailure("Connections list", error);
  }
}

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
    if (new URL(request.url).searchParams.get("direction") === "follower") {
      await removeFollower(auth.account.$id, parsed.data.username);
    } else {
      await removeRelationship(auth.account.$id, parsed.data.username);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return socialFailure("Unfollow action", error);
  }
}
