import { Account, AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";
import {
  isSameOrigin,
  jsonError,
  logAuthFailure,
} from "@/src/features/auth/http";
import {
  createAccountClient,
  getSessionCookieName,
} from "@/src/lib/appwrite/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "ORIGIN_REJECTED", "Request origin was rejected.");
  }

  const cookieStore = await cookies();
  const secret = cookieStore.get(getSessionCookieName())?.value;
  const response = NextResponse.json({ ok: true });

  if (!secret) {
    response.cookies.delete(getSessionCookieName());
    return response;
  }

  try {
    await new Account(createAccountClient(secret)).deleteSession({
      sessionId: "current",
    });
    response.cookies.delete(getSessionCookieName());
    return response;
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 401) {
      response.cookies.delete(getSessionCookieName());
      return response;
    }

    logAuthFailure("Logout", error);
    return jsonError(
      502,
      "LOGOUT_FAILED",
      "We could not end this session. Please try again.",
    );
  }
}
