import { apiClient } from "@/src/lib/api-client";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type AuthSession = {
  id: string;
  createdAt: string;
  expiresAt: string;
  device: string;
  operatingSystem: string;
  current: boolean;
};

export async function requestEmailCode(email: string): Promise<string> {
  const { data } = await apiClient.post<{ userId: string }>("/auth/email-token", {
    email,
  });
  return data.userId;
}

export async function verifyEmailCode(
  userId: string,
  secret: string,
): Promise<void> {
  await apiClient.post("/auth/verify-token", { userId, secret });
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const { data } = await apiClient.get<{ user: AuthUser | null }>("/auth/me");
  return data.user;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function fetchSessions(): Promise<AuthSession[]> {
  const { data } = await apiClient.get<{ sessions: AuthSession[] }>(
    "/auth/sessions",
  );
  return data.sessions;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await apiClient.delete("/auth/sessions", { data: { sessionId } });
}
