import { Account, AppwriteException } from "node-appwrite";
import { cookies } from "next/headers";
import {
  createAccountClient,
  getSessionCookieName,
} from "@/src/lib/appwrite/server";
import { jsonError } from "@/src/features/auth/http";

export async function GET() {
  const cookieStore = await cookies();
  const secret = cookieStore.get(getSessionCookieName())?.value;
  const headers = { "Cache-Control": "private, no-store" };

  if (!secret) {
    return Response.json({ user: null }, { headers });
  }

  try {
    const account = await new Account(createAccountClient(secret)).get();

    return Response.json(
      {
        user: {
          id: account.$id,
          email: account.email,
          name: account.name,
        },
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 401) {
      return Response.json({ user: null });
    }

    console.error(
      "Current account lookup failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return jsonError(502, "ACCOUNT_UNAVAILABLE", "Account is unavailable.");
  }
}
