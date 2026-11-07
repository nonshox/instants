import "server-only";
import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getCurrentAccount } from "@/src/features/auth/session";
import { isSameOrigin, jsonError, logAuthFailure } from "@/src/features/auth/http";
import { SocialError } from "@/src/features/social/service";

export async function getSocialAccount() {
  await cookies();
  try {
    return { account: await getCurrentAccount() };
  } catch (error) {
    logAuthFailure("Social authentication", error);
    return {
      response: jsonError(
        502,
        "AUTH_UNAVAILABLE",
        "Authentication is temporarily unavailable.",
      ),
    };
  }
}

export async function parseSocialInput<Schema extends z.ZodType>(
  request: Request,
  schema: Schema,
): Promise<
  | { success: true; data: z.output<Schema> }
  | { success: false; response: NextResponse }
> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: jsonError(400, "INVALID_JSON", "Request body must be valid JSON."),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      response: jsonError(400, "INVALID_INPUT", "Check the submitted fields."),
    };
  }
  return { success: true, data: parsed.data };
}

export function rejectForeignOrigin(request: Request): NextResponse | null {
  return isSameOrigin(request)
    ? null
    : jsonError(403, "ORIGIN_REJECTED", "Request origin was rejected.");
}

export function socialFailure(
  operation: string,
  error: unknown,
): NextResponse {
  if (error instanceof SocialError) {
    const notFound = error.code === "PROFILE_NOT_FOUND" ||
      error.code === "REQUEST_NOT_FOUND" ||
      error.code === "BLOCKED";
    return jsonError(
      notFound ? 404 : 409,
      notFound ? "NOT_FOUND" : error.code,
      notFound
        ? "That account or request is unavailable."
        : "This action is not available.",
    );
  }

  const detail =
    error instanceof AppwriteException
      ? `Appwrite ${error.code} (${error.type})`
      : error instanceof Error
        ? error.name
        : "UnknownError";
  console.error(`${operation} failed: ${detail}`);
  if (error instanceof AppwriteException && error.code === 409) {
    return jsonError(
      409,
      "RELATIONSHIP_CONFLICT",
      "The relationship changed. Refresh and try again.",
    );
  }
  return jsonError(
    503,
    "SOCIAL_UNAVAILABLE",
    "Connections are temporarily unavailable. Please try again.",
  );
}
