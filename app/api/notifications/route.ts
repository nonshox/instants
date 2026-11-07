import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import {
  getSocialAccount,
  parseSocialInput,
  rejectForeignOrigin,
  socialFailure,
} from "@/src/features/social/http";
import {
  listNotifications,
  readNotifications,
} from "@/src/features/notifications/service";
import {
  notificationCursorSchema,
  readNotificationsSchema,
} from "@/src/features/notifications/schemas";

export async function GET(request: Request) {
  const auth = await getSocialAccount();
  if ("response" in auth) {
    return auth.response;
  }
  if (!auth.account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view notifications.");
  }

  const rawCursor = new URL(request.url).searchParams.get("cursor");
  const parsedCursor = rawCursor
    ? notificationCursorSchema.safeParse(rawCursor)
    : { success: true as const, data: null };
  if (!parsedCursor.success) {
    return jsonError(400, "INVALID_CURSOR", "Notification cursor is invalid.");
  }

  try {
    const result = await listNotifications(
      auth.account.$id,
      parsedCursor.data,
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return socialFailure("Notification list", error);
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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to update notifications.");
  }

  const parsed = await parseSocialInput(request, readNotificationsSchema);
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    await readNotifications(auth.account.$id, parsed.data.ids);
    return NextResponse.json({ updated: true });
  } catch (error) {
    return socialFailure("Notification update", error);
  }
}
