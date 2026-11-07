import { Account } from "node-appwrite";
import { NextResponse } from "next/server";
import { revokeSessionSchema } from "@/src/features/auth/schemas";
import {
  appwriteStatus,
  isSameOrigin,
  jsonError,
  logAuthFailure,
} from "@/src/features/auth/http";
import {
  createAccountClient,
  getSessionCookieName,
} from "@/src/lib/appwrite/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const secret = cookieStore.get(getSessionCookieName())?.value;

  if (!secret) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view sessions.");
  }

  try {
    const sessions = await new Account(createAccountClient(secret)).listSessions();

    return NextResponse.json({
      sessions: sessions.sessions.map((session) => ({
        id: session.$id,
        createdAt: session.$createdAt,
        expiresAt: session.expire,
        device: session.deviceName || session.clientName || "Unknown device",
        operatingSystem: session.osName,
        current: session.current,
      })),
    });
  } catch (error) {
    const status = appwriteStatus(error);
    logAuthFailure("Session listing", error);
    return jsonError(
      status ?? 502,
      status === 401 ? "UNAUTHENTICATED" : "SESSIONS_UNAVAILABLE",
      status === 401 ? "Sign in to view sessions." : "Sessions are unavailable.",
    );
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "ORIGIN_REJECTED", "Request origin was rejected.");
  }

  const cookieStore = await cookies();
  const secret = cookieStore.get(getSessionCookieName())?.value;

  if (!secret) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to manage sessions.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = revokeSessionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Choose a valid session.");
  }

  try {
    const account = new Account(createAccountClient(secret));
    const sessions = await account.listSessions();
    const target = sessions.sessions.find(
      (session) => session.$id === parsed.data.sessionId,
    );

    if (!target) {
      return jsonError(404, "SESSION_NOT_FOUND", "Session was not found.");
    }

    await account.deleteSession({ sessionId: target.$id });

    const response = NextResponse.json({ ok: true });
    if (target.current) {
      response.cookies.delete(getSessionCookieName());
    }

    return response;
  } catch (error) {
    const status = appwriteStatus(error);
    logAuthFailure("Session revocation", error);
    return jsonError(
      status ?? 502,
      status === 401 ? "UNAUTHENTICATED" : "SESSION_REVOCATION_FAILED",
      status === 401
        ? "Sign in to manage sessions."
        : "We could not revoke that session.",
    );
  }
}
