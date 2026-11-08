import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import { getCurrentAccount } from "@/src/features/auth/session";
import {
  getAuthorizedInstantImage,
  InstantNotFoundError,
} from "@/src/features/instants/service";
import { instantIdSchema } from "@/src/features/instants/schemas";
import { logInstantFailure } from "@/src/features/instants/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ instantId: string }> },
) {
  const { instantId } = await context.params;
  if (!instantIdSchema.safeParse(instantId).success) {
    return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
  }

  try {
    const account = await getCurrentAccount();
    const image = await getAuthorizedInstantImage(
      instantId,
      account?.$id ?? null,
    );
    const body = new Uint8Array(image.bytes.byteLength);
    body.set(image.bytes);
    return new NextResponse(body.buffer, {
      headers: {
        "Content-Type": image.mimeType,
        "Cache-Control": "private, max-age=300",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-site",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof InstantNotFoundError) {
      return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
    }
    if (error instanceof AppwriteException && error.code === 401) {
      return jsonError(404, "INSTANT_UNAVAILABLE", "This Instant is unavailable.");
    }
    logInstantFailure("Authorized image retrieval", error);
    return jsonError(502, "IMAGE_UNAVAILABLE", "Image could not be retrieved.");
  }
}
