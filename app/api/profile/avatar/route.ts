import { NextResponse } from "next/server";
import {
  isSameOrigin,
  jsonError,
  logAuthFailure,
} from "@/src/features/auth/http";
import { getCurrentAccount } from "@/src/features/auth/session";
import { MAX_IMAGE_BYTES } from "@/src/features/instants/schemas";
import {
  AvatarUnavailableError,
  InvalidAvatarImageError,
  UnsupportedAvatarImageError,
  clearAvatarForAccount,
  setAvatarForAccount,
} from "@/src/features/profile/avatar";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function getAccount() {
  try {
    return { account: await getCurrentAccount() };
  } catch (error) {
    logAuthFailure("Profile avatar authentication", error);
    return {
      response: jsonError(
        502,
        "AUTH_UNAVAILABLE",
        "Authentication is temporarily unavailable.",
      ),
    };
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "ORIGIN_REJECTED", "Request origin was rejected.");
  }

  const auth = await getAccount();
  if ("response" in auth) {
    return auth.response;
  }

  const account = auth.account;
  if (!account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to update your avatar.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "INVALID_FORM", "Select an image and try again.");
  }

  const files = form.getAll("image");
  const image = files[0];
  if (files.length !== 1 || !(image instanceof File)) {
    return jsonError(400, "INVALID_FORM", "Select one image and try again.");
  }
  if (!ALLOWED_TYPES.has(image.type)) {
    return jsonError(
      400,
      "IMAGE_INVALID",
      "That photo can't be used. Try another one.",
    );
  }
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return jsonError(
      413,
      "IMAGE_SIZE_INVALID",
      "That photo can't be uploaded. Try another one.",
    );
  }

  try {
    const result = await setAvatarForAccount(
      account.$id,
      account.email,
      Buffer.from(await image.arrayBuffer()),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof InvalidAvatarImageError ||
      error instanceof UnsupportedAvatarImageError
    ) {
      return jsonError(400, "IMAGE_INVALID", error.message);
    }
    if (error instanceof AvatarUnavailableError) {
      return jsonError(404, "PROFILE_NOT_FOUND", "Create your profile first.");
    }
    logAuthFailure("Avatar upload", error);
    return jsonError(502, "AVATAR_UPDATE_FAILED", "Avatar could not be saved.");
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "ORIGIN_REJECTED", "Request origin was rejected.");
  }

  const auth = await getAccount();
  if ("response" in auth) {
    return auth.response;
  }

  const account = auth.account;
  if (!account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to remove your avatar.");
  }

  try {
    await clearAvatarForAccount(account.$id, account.email);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AvatarUnavailableError) {
      return jsonError(404, "PROFILE_NOT_FOUND", "Create your profile first.");
    }
    logAuthFailure("Avatar removal", error);
    return jsonError(502, "AVATAR_REMOVE_FAILED", "Avatar could not be removed.");
  }
}
