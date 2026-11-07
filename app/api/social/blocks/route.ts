import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import {
  getSocialAccount,
  parseSocialInput,
  rejectForeignOrigin,
  socialFailure,
} from "@/src/features/social/http";
import {
  blockedListSchema,
  relationshipInputSchema,
} from "@/src/features/social/schemas";
import {
  blockByUsername,
  listBlockedAccounts,
  unblockByUsername,
} from "@/src/features/social/service";

export async function GET(request: Request) {
  const auth = await getSocialAccount();
  if ("response" in auth) return auth.response;
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view blocked accounts.");
  }
  const params = new URL(request.url).searchParams;
  const parsed = blockedListSchema.safeParse({
    cursor: params.get("cursor") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "The blocked list cursor is invalid.");
  }
  try {
    return NextResponse.json(
      await listBlockedAccounts(auth.account.$id, parsed.data.cursor ?? null),
    );
  } catch (error) {
    return socialFailure("Blocked accounts list", error);
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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to block accounts.");
  }
  const parsed = await parseSocialInput(request, relationshipInputSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    await blockByUsername(auth.account.$id, parsed.data.username);
    return NextResponse.json({ blocked: true });
  } catch (error) {
    return socialFailure("Block action", error);
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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to unblock accounts.");
  }
  const parsed = relationshipInputSchema.safeParse({
    username: new URL(request.url).searchParams.get("username"),
  });
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Enter a valid username.");
  }

  try {
    await unblockByUsername(auth.account.$id, parsed.data.username);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return socialFailure("Unblock action", error);
  }
}
