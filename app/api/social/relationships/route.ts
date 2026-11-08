import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import {
  getSocialAccount,
  parseSocialInput,
  rejectForeignOrigin,
  socialFailure,
} from "@/src/features/social/http";
import {
  linkByUsername,
  listConnections,
  unlinkByUsername,
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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view your links.");
  }
  const params = new URL(request.url).searchParams;
  const parsed = connectionListSchema.safeParse({
    cursor: params.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Choose a valid links list.");
  }
  try {
    return NextResponse.json(
      await listConnections(auth.account.$id, parsed.data.cursor ?? null),
    );
  } catch (error) {
    return socialFailure("Links list", error);
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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to link accounts.");
  }
  const parsed = await parseSocialInput(request, relationshipInputSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const relationship = await linkByUsername(
      auth.account.$id,
      parsed.data.username,
    );
    return NextResponse.json({ relationship });
  } catch (error) {
    return socialFailure("Link action", error);
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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to manage links.");
  }
  const parsed = relationshipInputSchema.safeParse({
    username: new URL(request.url).searchParams.get("username"),
  });
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Enter a valid username.");
  }

  try {
    await unlinkByUsername(auth.account.$id, parsed.data.username);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return socialFailure("Unlink action", error);
  }
}
