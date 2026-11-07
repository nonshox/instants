import "server-only";
import { AppwriteException } from "node-appwrite";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/src/features/auth/session";
import { isSameOrigin, jsonError } from "@/src/features/auth/http";
import { InstantNotFoundError } from "./service";

export async function getInstantAccount() {
  await cookies();
  try {
    return { account: await getCurrentAccount() };
  } catch (error) {
    logInstantFailure("Instant authentication", error);
    return {
      response: jsonError(
        502,
        "AUTH_UNAVAILABLE",
        "Authentication is temporarily unavailable.",
      ),
    };
  }
}

export function rejectInstantMutationOrigin(
  request: Request,
): NextResponse | null {
  return isSameOrigin(request)
    ? null
    : jsonError(403, "ORIGIN_REJECTED", "Request origin was rejected.");
}

export function logInstantFailure(
  operation: string,
  error: unknown,
): void {
  const detail =
    error instanceof AppwriteException
      ? `Appwrite ${error.code}`
      : error instanceof Error
        ? error.name
        : "UnknownError";
  console.error(`${operation} failed: ${detail}`);
}

export function instantServiceError(error: unknown): NextResponse {
  if (error instanceof InstantNotFoundError) {
    return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
  }
  logInstantFailure("Instant operation", error);
  return jsonError(502, "INSTANT_UNAVAILABLE", "The Instant is unavailable.");
}
