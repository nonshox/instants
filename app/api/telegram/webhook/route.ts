import { z } from "zod";
import { after } from "next/server";
import { jsonError } from "@/src/features/auth/http";
import { logInstantFailure } from "@/src/features/instants/http";
import {
  consumeTelegramLink,
  sendTelegramNotification,
  verifyTelegramWebhookSecret,
} from "@/src/features/telegram/service";

const telegramIdSchema = z.union([
  z.number().int().safe().positive(),
  z.string().regex(/^[1-9]\d{0,31}$/),
]);

export const maxDuration = 30;

const telegramUpdateSchema = z.object({
  message: z
    .object({
      text: z.string().max(512),
      chat: z.object({
        id: telegramIdSchema,
        type: z.string(),
      }),
      from: z.object({
        id: telegramIdSchema,
      }),
    })
    .optional(),
});

export async function POST(request: Request) {
  if (
    !verifyTelegramWebhookSecret(
      request.headers.get("x-telegram-bot-api-secret-token"),
    )
  ) {
    return jsonError(403, "WEBHOOK_REJECTED", "Webhook authorization failed.");
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, "INVALID_UPDATE", "Webhook update is invalid.");
  }
  const parsed = telegramUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError(400, "INVALID_UPDATE", "Webhook update is invalid.");
  }

  const message = parsed.data.message;
  if (
    !message ||
    message.chat.type !== "private" ||
    String(message.chat.id) !== String(message.from.id)
  ) {
    return Response.json({ ok: true });
  }

  const start = /^\/start ([a-f0-9]{64})$/.exec(message.text);
  if (!start) {
    return Response.json({ ok: true });
  }

  try {
    const result = await consumeTelegramLink(
      start[1],
      String(message.from.id),
      String(message.chat.id),
    );
    if (result.status === "connected") {
      after(async () => {
        try {
          await sendTelegramNotification(
            result.userId,
            "Your Instant account is now connected to Telegram.",
          );
        } catch (error) {
          logInstantFailure("Telegram connection confirmation", error);
        }
      });
      return Response.json({ ok: true, connected: true });
    }
    return Response.json({ ok: true, connected: false });
  } catch (error) {
    logInstantFailure("Telegram webhook", error);
    return jsonError(503, "WEBHOOK_TEMPORARY_FAILURE", "Try again later.");
  }
}
