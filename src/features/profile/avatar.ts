import "server-only";
import sharp from "sharp";
import { AppwriteException, ID, type Models } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import {
  getBucketId,
  getDatabaseId,
  getStorage,
  getTables,
} from "@/src/features/instants/data";
import { findLink, findRelationship } from "@/src/features/social/data";
import { getProfileForAccount } from "@/src/features/profile/service";
import { logInstantFailure } from "@/src/features/instants/http";

const AVATAR_EDGE = 512;
const MAX_AVATAR_BYTES = 10_000_000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type AvatarRow = Models.Row & {
  avatar: string;
  username: string;
  private: boolean;
};

export class InvalidAvatarImageError extends Error {
  constructor() {
    super("That photo can't be used. Try another one.");
  }
}

export class UnsupportedAvatarImageError extends Error {
  constructor() {
    super("That photo can't be used. Try another one.");
  }
}

export class AvatarUnavailableError extends Error {
  constructor() {
    super("This avatar is unavailable.");
  }
}

export async function setAvatarForAccount(
  userId: string,
  authEmail: string,
  original: Buffer,
): Promise<{ avatar: string }> {
  const profile = await getProfileForAccount(userId, authEmail);
  if (!profile) {
    throw new AvatarUnavailableError();
  }

  const buffer = await processAvatar(original);
  const storage = getStorage();
  const bucketId = getBucketId();
  const fileId = ID.unique();

  await storage.createFile({
    bucketId,
    fileId,
    file: InputFile.fromBuffer(buffer, "avatar.webp"),
    permissions: [],
  });

  try {
    await getTables().updateRow({
      databaseId: getDatabaseId(),
      tableId: "users",
      rowId: userId,
      data: { avatar: fileId },
    });
  } catch (error) {
    await deleteFileQuietly(storage, bucketId, fileId);
    throw error;
  }

  if (profile.avatar) {
    await deleteFileQuietly(storage, bucketId, profile.avatar);
  }

  return { avatar: fileId };
}

export async function clearAvatarForAccount(
  userId: string,
  authEmail: string,
): Promise<void> {
  const profile = await getProfileForAccount(userId, authEmail);
  if (!profile) {
    throw new AvatarUnavailableError();
  }

  await getTables().updateRow({
    databaseId: getDatabaseId(),
    tableId: "users",
    rowId: userId,
    data: { avatar: "" },
  });

  if (profile.avatar) {
    await deleteFileQuietly(getStorage(), getBucketId(), profile.avatar);
  }
}

export async function getAuthorizedAvatar(
  targetId: string,
  viewerId: string | null,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const target = await getAvatarRow(targetId);
  if (!target || !target.avatar) {
    return null;
  }

  if (viewerId !== targetId) {
    if (viewerId) {
      const [blockForward, blockReverse] = await Promise.all([
        findRelationship("blocks", "blocker", viewerId, "blocked", targetId),
        findRelationship("blocks", "blocker", targetId, "blocked", viewerId),
      ]);
      if (blockForward || blockReverse) {
        return null;
      }
      if (target.private) {
        const link = await findLink(viewerId, targetId);
        if (!link) {
          return null;
        }
      }
    } else {
      return null;
    }
  }

  const storage = getStorage();
  const bucketId = getBucketId();
  const file = await storage.getFile({ bucketId, fileId: target.avatar });
  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    throw new AvatarUnavailableError();
  }
  const bytes = new Uint8Array(
    await storage.getFileView({ bucketId, fileId: target.avatar }),
  );
  return { bytes, mimeType: file.mimeType };
}

async function processAvatar(original: Buffer): Promise<Buffer> {
  let image: ReturnType<typeof sharp>;
  let format: string | undefined;
  try {
    image = sharp(original, {
      failOn: "error",
      limitInputPixels: 25_000_000,
    });
    format = (await image.metadata()).format;
  } catch {
    throw new InvalidAvatarImageError();
  }

  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new UnsupportedAvatarImageError();
  }

  try {
    const buffer = await image
      .rotate()
      .resize(AVATAR_EDGE, AVATAR_EDGE, {
        fit: "cover",
        position: "centre",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    if (buffer.byteLength > MAX_AVATAR_BYTES) {
      throw new UnsupportedAvatarImageError();
    }
    return buffer;
  } catch (error) {
    if (error instanceof UnsupportedAvatarImageError) {
      throw error;
    }
    throw new InvalidAvatarImageError();
  }
}

async function getAvatarRow(userId: string): Promise<AvatarRow | null> {
  try {
    return await getTables().getRow<AvatarRow>({
      databaseId: getDatabaseId(),
      tableId: "users",
      rowId: userId,
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return null;
    }
    throw error;
  }
}

async function deleteFileQuietly(
  storage: ReturnType<typeof getStorage>,
  bucketId: string,
  fileId: string,
): Promise<void> {
  try {
    await storage.deleteFile({ bucketId, fileId });
  } catch (error) {
    logInstantFailure("Avatar file cleanup", error);
  }
}
