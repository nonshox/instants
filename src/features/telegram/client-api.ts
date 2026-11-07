import { apiClient } from "@/src/lib/api-client";

export async function fetchTelegramStatus(): Promise<boolean> {
  const { data } = await apiClient.get<{ connected: boolean }>("/telegram/link");
  return data.connected;
}

export async function createTelegramLink(): Promise<string> {
  const { data } = await apiClient.post<{ link: string }>("/telegram/link");
  return data.link;
}

export async function disconnectTelegram(): Promise<void> {
  await apiClient.delete("/telegram/link");
}
