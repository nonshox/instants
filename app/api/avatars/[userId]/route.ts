import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";
import {
  jsonError,
  logAuthFailure,
} from "@/src/features/auth/http";
import { getCurrentAccount } from "@/src/features/auth/session";
import { instantIdSchema } from "@/src/features/instants/schemas";
import {
  AvatarUnavailableError,
  getAuthorizedAvatar,
} from "@/src/features/profile/avatar";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  if (!instantIdSchema.safeParse(userId).success) {
    return jsonError(404, "AVATAR_UNAVAILABLE", "This avatar is unavailable.");
  }

  let account: Awaited<ReturnType<typeof getCurrentAccount>>;
  try {
    account = await getCurrentAccount();
  } catch (error) {
    logAuthFailure("Avatar authentication", error);
    return jsonError(
      502,
      "AUTH_UNAVAILABLE",
      "Authentication is temporarily unavailable.",
    );
  }

  if (!account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view this avatar.");
  }

  try {
    const avatar = await getAuthorizedAvatar(userId, account.$id);
    if (!avatar) {
      return jsonError(404, "AVATAR_UNAVAILABLE", "This avatar is unavailable.");
    }
    const body = new Uint8Array(avatar.bytes.byteLength);
    body.set(avatar.bytes);
    return new NextResponse(body.buffer, {
      headers: {
        "Content-Type": avatar.mimeType,
        "Cache-Control": "private, no-store",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-site",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (
      error instanceof AvatarUnavailableError ||
      (error instanceof AppwriteException && error.code === 404)
    ) {
      return jsonError(404, "AVATAR_UNAVAILABLE", "This avatar is unavailable.");
    }
    logAuthFailure("Avatar retrieval", error);
    return jsonError(502, "AVATAR_UNAVAILABLE", "Avatar could not be retrieved.");
  }
}
