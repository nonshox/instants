import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";

export function jsonError(
  status: number,
  code: string,
  message: string,
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function logAuthFailure(
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

export function appwriteStatus(error: unknown): number | undefined {
  if (!(error instanceof AppwriteException)) {
    return undefined;
  }

  if (error.code === 401) {
    return 401;
  }

  if (error.code === 429) {
    return 429;
  }

  return undefined;
}
