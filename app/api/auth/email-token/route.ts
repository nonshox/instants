import { Account } from "node-appwrite";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { emailTokenRequestSchema } from "@/src/features/auth/schemas";
import {
  appwriteStatus,
  isSameOrigin,
  jsonError,
  logAuthFailure,
} from "@/src/features/auth/http";
import { createAccountClient } from "@/src/lib/appwrite/server";

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

  const parsed = emailTokenRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "INVALID_INPUT", "Enter a valid email address.");
  }

  try {
    const account = new Account(createAccountClient());
    const token = await account.createEmailToken({
      userId: randomUUID(),
      email: parsed.data.email,
    });

    return NextResponse.json({
      userId: token.userId,
      expiresAt: token.expire,
    });
  } catch (error) {
    const status = appwriteStatus(error);
    logAuthFailure("Email code request", error);
    return jsonError(
      status ?? 502,
      status === 429 ? "RATE_LIMITED" : "EMAIL_CODE_UNAVAILABLE",
      status === 429
        ? "Too many requests. Please wait before trying again."
        : "We could not send a sign-in code right now. Please try again.",
    );
  }
}
