import { Account } from "node-appwrite";
import { NextResponse } from "next/server";
import { emailTokenVerifySchema } from "@/src/features/auth/schemas";
import {
  appwriteStatus,
  isSameOrigin,
  jsonError,
  logAuthFailure,
} from "@/src/features/auth/http";
import {
  createAccountClient,
  createAdminClient,
  getSessionCookieName,
} from "@/src/lib/appwrite/server";
import { ensureProfileForAccount } from "@/src/features/profile/service";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "ORIGIN_REJECTED", "Request origin was rejected.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = emailTokenVerifySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      400,
      "INVALID_INPUT",
      "Enter the six-digit code from your email.",
    );
  }

  try {
    const account = new Account(createAdminClient());
    const session = await account.createSession(parsed.data);
    const expiresAt = new Date(session.expire);

    if (
      !session.secret ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt <= new Date()
    ) {
      throw new Error("Appwrite returned an invalid session.");
    }

    const signedInAccount = await new Account(
      createAccountClient(session.secret),
    ).get();
    await ensureProfileForAccount(signedInAccount.$id, signedInAccount.email);

    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set(getSessionCookieName(), session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error) {
    const status = appwriteStatus(error);
    if (status === 401) {
      return jsonError(
        401,
        "INVALID_OR_EXPIRED_CODE",
        "That code is invalid or has expired. Request a new one and try again.",
      );
    }

    logAuthFailure("Email code verification", error);
    return jsonError(
      status ?? 502,
      status === 429 ? "RATE_LIMITED" : "SIGN_IN_UNAVAILABLE",
      status === 429
        ? "Too many attempts. Please wait before trying again."
        : "We could not sign you in right now. Please try again.",
    );
  }
}
