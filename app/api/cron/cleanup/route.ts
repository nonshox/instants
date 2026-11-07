import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import { runDailyCleanup } from "@/src/features/cron/cleanup";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"))) {
    return jsonError(401, "UNAUTHORIZED", "Cron authorization failed.");
  }
  try {
    const result = await runDailyCleanup();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error(
      "Daily cleanup failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return jsonError(502, "CLEANUP_FAILED", "Cleanup could not be completed.");
  }
}

function isAuthorizedCron(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization?.startsWith("Bearer ")) {
    return false;
  }
  const received = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return (
    received.byteLength === expected.byteLength &&
    timingSafeEqual(received, expected)
  );
}
