import "server-only";
import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { AppwriteException, ID, Query, type Models } from "node-appwrite";
import { runTransaction } from "@/src/features/social/data";
import { getDatabaseId, getTables } from "@/src/features/instants/data";

type TelegramTokenRow = Models.Row & {
  user: string;
  hash: string;
  expires: string;
  used: boolean;
};

type TelegramConnectionRow = Models.Row & {
  user: string;
  tid: string;
  chat: string;
  created: string;
};

export async function createTelegramLink(userId: string): Promise<string> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (!botUsername || !/^[A-Za-z0-9_]{2,29}bot$/i.test(botUsername)) {
    throw new Error("Telegram bot username is not configured.");
  }
  const tables = getTables();
  const currentToken = await getTelegramTokenByUser(userId);
  const now = Date.now();
  if (
    currentToken &&
    Date.parse(currentToken.expires) - now > 9.5 * 60 * 1000
  ) {
    throw new TelegramLinkRateLimitError();
  }
  const rawToken = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(rawToken).digest("hex");
  const data = {
    user: userId,
    hash,
    expires: new Date(now + 10 * 60 * 1000).toISOString(),
    used: false,
  };
  if (currentToken) {
    await tables.updateRow({
      databaseId: getDatabaseId(),
      tableId: "tg_tokens",
      rowId: currentToken.$id,
      data,
    });
  } else {
    await tables.createRow<TelegramTokenRow>({
      databaseId: getDatabaseId(),
      tableId: "tg_tokens",
      rowId: userId,
      permissions: [],
      data,
    });
  }
  return `https://t.me/${botUsername}?start=${rawToken}`;
}

export async function consumeTelegramLink(
  rawToken: string,
  telegramUserId: string,
  chatId: string,
): Promise<
  | { status: "connected"; userId: string }
  | { status: "invalid" | "expired" | "used" | "conflict" }
> {
  const hash = createHash("sha256").update(rawToken).digest("hex");
  const result = await getTables().listRows<TelegramTokenRow>({
    databaseId: getDatabaseId(),
    tableId: "tg_tokens",
    queries: [Query.equal("hash", hash), Query.limit(1)],
    total: false,
  });
  const token = result.rows[0];
  if (!token) {
    return { status: "invalid" };
  }
  if (token.used) {
    return { status: "used" };
  }
  if (Date.parse(token.expires) <= Date.now()) {
    return { status: "expired" };
  }

  const [userConnection, telegramConnection] = await Promise.all([
    findTelegramConnection("user", token.user),
    findTelegramConnection("tid", telegramUserId),
  ]);
  if (telegramConnection && telegramConnection.user !== token.user) {
    return { status: "conflict" };
  }

  try {
    await runTransaction(async (transactionId) => {
      const currentToken = await getTables().getRow<TelegramTokenRow>({
        databaseId: getDatabaseId(),
        tableId: "tg_tokens",
        rowId: token.$id,
      });
      if (currentToken.used || Date.parse(currentToken.expires) <= Date.now()) {
        throw new TelegramLinkRaceError();
      }

      await getTables().updateRow({
        databaseId: getDatabaseId(),
        tableId: "tg_tokens",
        rowId: currentToken.$id,
        transactionId,
        data: { used: true },
      });

      if (userConnection) {
        await getTables().updateRow({
          databaseId: getDatabaseId(),
          tableId: "tg",
          rowId: userConnection.$id,
          transactionId,
          data: {
            tid: telegramUserId,
            chat: chatId,
          },
        });
      } else {
        await getTables().createRow<TelegramConnectionRow>({
          databaseId: getDatabaseId(),
          tableId: "tg",
          rowId: ID.unique(),
          permissions: [],
          transactionId,
          data: {
            user: token.user,
            tid: telegramUserId,
            chat: chatId,
            created: new Date().toISOString(),
          },
        });
      }
    });
    return { status: "connected", userId: token.user };
  } catch (error) {
    if (error instanceof TelegramLinkRaceError) {
      return { status: "used" };
    }
    if (error instanceof AppwriteException && error.code === 409) {
      return { status: "conflict" };
    }
    throw error;
  }
}

export async function removeTelegramConnection(userId: string): Promise<void> {
  const connection = await findTelegramConnection("user", userId);
  const token = await getTelegramTokenByUser(userId);
  if (!connection && !token) return;

  await runTransaction(async (transactionId) => {
    if (connection) {
      await getTables().deleteRow({
        databaseId: getDatabaseId(),
        tableId: "tg",
        rowId: connection.$id,
        transactionId,
      });
    }
    if (token && !token.used) {
      await getTables().updateRow({
        databaseId: getDatabaseId(),
        tableId: "tg_tokens",
        rowId: token.$id,
        transactionId,
        data: { used: true },
      });
    }
  });
}

export async function getTelegramConnectionStatus(userId: string): Promise<boolean> {
  return Boolean(await findTelegramConnection("user", userId));
}

export class TelegramLinkRateLimitError extends Error {}

export async function sendTelegramNotification(
  userId: string,
  text: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Telegram bot token is not configured.");
  }
  const connection = await findTelegramConnection("user", userId);
  if (!connection) {
    return;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: connection.chat, text }),
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) {
        throw new TelegramDeliveryError(response.status);
      }
      const result: unknown = await response.json();
      if (
        typeof result !== "object" ||
        result === null ||
        !("ok" in result) ||
        result.ok !== true
      ) {
        throw new TelegramDeliveryError(response.status);
      }
      return;
    } catch (error) {
      lastError = error;
      if (error instanceof TelegramDeliveryError && error.status < 500 && error.status !== 429) {
        break;
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
      }
    }
  }
  const detail =
    lastError instanceof TelegramDeliveryError
      ? `HTTP ${lastError.status}`
      : lastError instanceof Error
        ? lastError.name
        : "UnknownError";
  throw new Error(`Telegram delivery failed: ${detail}`);
}

export function verifyTelegramWebhookSecret(received: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (
    !received ||
    !expected ||
    !/^[A-Za-z0-9_-]{1,256}$/.test(expected)
  ) {
    return false;
  }
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(receivedBytes, expectedBytes)
  );
}

async function findTelegramConnection(
  key: "user" | "tid",
  value: string,
): Promise<TelegramConnectionRow | null> {
  const result = await getTables().listRows<TelegramConnectionRow>({
    databaseId: getDatabaseId(),
    tableId: "tg",
    queries: [Query.equal(key, value), Query.limit(1)],
    total: false,
  });
  return result.rows[0] ?? null;
}

async function getTelegramTokenByUser(
  userId: string,
): Promise<TelegramTokenRow | null> {
  try {
    return await getTables().getRow<TelegramTokenRow>({
      databaseId: getDatabaseId(),
      tableId: "tg_tokens",
      rowId: userId,
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return null;
    }
    throw error;
  }
}

class TelegramLinkRaceError extends Error {}

class TelegramDeliveryError extends Error {
  constructor(readonly status: number) {
    super(`Telegram returned HTTP ${status}.`);
  }
}
