import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import {
  getSocialAccount,
  rejectForeignOrigin,
} from "@/src/features/social/http";
import {
  createTelegramLink,
  getTelegramConnectionStatus,
  removeTelegramConnection,
  TelegramLinkRateLimitError,
} from "@/src/features/telegram/service";
import { logInstantFailure } from "@/src/features/instants/http";

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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to connect Telegram.");
  }

  try {
    const link = await createTelegramLink(auth.account.$id);
    return NextResponse.json({ link });
  } catch (error) {
    if (error instanceof TelegramLinkRateLimitError) {
      return jsonError(429, "RATE_LIMITED", "Wait briefly before requesting another link.");
    }
    logInstantFailure("Telegram link", error);
    return jsonError(
      502,
      "TELEGRAM_UNAVAILABLE",
      "A Telegram connection link could not be created.",
    );
  }
}

export async function GET() {
  const auth = await getSocialAccount();
  if ("response" in auth) return auth.response;
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view Telegram status.");
  }
  try {
    const connected = await getTelegramConnectionStatus(auth.account.$id);
    return NextResponse.json({ connected }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    logInstantFailure("Telegram connection status", error);
    return jsonError(502, "TELEGRAM_UNAVAILABLE", "Telegram status is unavailable.");
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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to disconnect Telegram.");
  }

  try {
    await removeTelegramConnection(auth.account.$id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logInstantFailure("Telegram disconnect", error);
    return jsonError(
      502,
      "TELEGRAM_UNAVAILABLE",
      "The Telegram connection could not be removed.",
    );
  }
}
