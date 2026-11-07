import { AppwriteException } from "node-appwrite";
import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/src/features/auth/session";
import {
  isSameOrigin,
  jsonError,
  logAuthFailure,
} from "@/src/features/auth/http";
import { profileInputSchema } from "@/src/features/auth/schemas";
import {
  createProfileForAccount,
  getProfileForAccount,
  updateProfileForAccount,
} from "@/src/features/profile/service";

async function getAccount() {
  try {
    return { account: await getCurrentAccount() };
  } catch (error) {
    logAuthFailure("Profile authentication", error);
    return {
      response: jsonError(
        502,
        "AUTH_UNAVAILABLE",
        "Authentication is temporarily unavailable.",
      ),
    };
  }
}

export async function GET() {
  const auth = await getAccount();
  if ("response" in auth) {
    return auth.response;
  }

  const account = auth.account;
  if (!account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to view your profile.");
  }

  try {
    const profile = await getProfileForAccount(account.$id, account.email);
    return NextResponse.json({ profile });
  } catch (error) {
    logAuthFailure("Profile lookup", error);
    return jsonError(502, "PROFILE_UNAVAILABLE", "Profile is unavailable.");
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
    return jsonError(401, "UNAUTHENTICATED", "Sign in to create your profile.");
  }

  const parsed = await parseProfileInput(request);
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const existing = await getProfileForAccount(account.$id, account.email);
    if (existing) {
      return jsonError(
        409,
        "PROFILE_EXISTS",
        "Your profile already exists. Refresh and try again.",
      );
    }

    const profile = await createProfileForAccount(
      account.$id,
      account.email,
      parsed.data,
    );
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      return jsonError(
        409,
        "USERNAME_UNAVAILABLE",
        "That username is unavailable. Try another one.",
      );
    }

    logAuthFailure("Profile creation", error);
    return jsonError(502, "PROFILE_CREATE_FAILED", "Profile could not be saved.");
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return jsonError(403, "ORIGIN_REJECTED", "Request origin was rejected.");
  }

  const auth = await getAccount();
  if ("response" in auth) {
    return auth.response;
  }

  const account = auth.account;
  if (!account) {
    return jsonError(401, "UNAUTHENTICATED", "Sign in to edit your profile.");
  }

  const parsed = await parseProfileInput(request);
  if (!parsed.success) {
    return parsed.response;
  }

  try {
    const profile = await updateProfileForAccount(
      account.$id,
      account.email,
      parsed.data,
    );

    if (!profile) {
      return jsonError(404, "PROFILE_NOT_FOUND", "Create your profile first.");
    }

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      return jsonError(
        409,
        "USERNAME_UNAVAILABLE",
        "That username is unavailable. Try another one.",
      );
    }

    logAuthFailure("Profile update", error);
    return jsonError(502, "PROFILE_UPDATE_FAILED", "Profile could not be saved.");
  }
}

async function parseProfileInput(
  request: Request,
): Promise<
  | { success: true; data: ReturnType<typeof profileInputSchema.parse> }
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

  const parsed = profileInputSchema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      response: jsonError(
        400,
        "INVALID_INPUT",
        "Check the username, name, and bio fields.",
      ),
    };
  }

  return { success: true, data: parsed.data };
}
