import "server-only";
import { AppwriteException, ID, Query, type Models } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { canViewInstant } from "./policy";
import { findLink } from "@/src/features/social/data";
import {
  optimizeImage,
  InvalidInstantImageError,
  UnsupportedImageError,
} from "./image";
import {
  getBucketId,
  getDatabaseId,
  getInstantRow,
  getStorage,
  getTables,
  getUserPrivacy,
  type InstantRow,
} from "./data";

export type CreatedInstant = {
  id: string;
  imageUrl: string;
  caption: string;
  likes: number;
  createdAt: string;
  expires: string;
};

export type UpdatedInstantCaption = {
  id: string;
  caption: string;
};

export class InstantNotFoundError extends Error {
  constructor() {
    super("Instant is unavailable.");
  }
}

export async function createInstant(
  ownerId: string,
  instantId: string,
  caption: string,
  original: Buffer,
): Promise<CreatedInstant> {
  const existing = await getInstantRow(instantId);
  if (existing) {
    if (existing.user !== ownerId) {
      throw new InstantConflictError();
    }
    return toCreatedInstant(existing);
  }

  const optimized = await optimizeImage(original);
  if (optimized.buffer.byteLength > 10_000_000) {
    throw new UnsupportedInstantImageError(
      "The optimized image exceeds the 10 MB limit.",
    );
  }

  const storage = getStorage();
  const bucketId = getBucketId();
  const fileId = ID.unique();
  await storage.createFile({
    bucketId,
    fileId,
    file: InputFile.fromBuffer(
      optimized.buffer,
      `instant.${optimized.extension}`,
    ),
    permissions: [],
  });

  try {
    const expires = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
    const row = await getTables().createRow<InstantRow>({
      databaseId: getDatabaseId(),
      tableId: "instants",
      rowId: instantId,
      permissions: [],
      data: {
        user: ownerId,
        image: fileId,
        expires,
        likes: 0,
        cap: caption,
      },
    });

    return toCreatedInstant(row);
  } catch (error) {
    let committed: InstantRow | null;
    try {
      committed = await getInstantRow(instantId);
    } catch (lookupError) {
      console.error(
        "Instant upload status lookup failed:",
        lookupError instanceof AppwriteException
          ? lookupError.code
          : lookupError instanceof Error
            ? lookupError.name
            : "UnknownError",
      );
      throw error;
    }

    if (committed?.user === ownerId) {
      if (committed.image !== fileId) {
        await deleteUploadedFile(storage, bucketId, fileId);
      }
      return toCreatedInstant(committed);
    }

    await deleteUploadedFile(storage, bucketId, fileId);
    if (committed || (error instanceof AppwriteException && error.code === 409)) {
      throw new InstantConflictError();
    }
    throw error;
  }
}

async function deleteUploadedFile(
  storage: ReturnType<typeof getStorage>,
  bucketId: string,
  fileId: string,
): Promise<void> {
  try {
    await storage.deleteFile({ bucketId, fileId });
  } catch (error) {
    console.error(
      "Instant upload cleanup failed:",
      error instanceof AppwriteException
        ? error.code
        : error instanceof Error
          ? error.name
          : "UnknownError",
    );
    throw new Error("Uploaded image cleanup failed.");
  }
}

export async function updateOwnedInstantCaption(
  ownerId: string,
  instantId: string,
  caption: string,
): Promise<UpdatedInstantCaption> {
  const instant = await getInstantRow(instantId);
  if (!instant || instant.user !== ownerId) {
    throw new InstantNotFoundError();
  }

  const row = await getTables().updateRow<InstantRow>({
    databaseId: getDatabaseId(),
    tableId: "instants",
    rowId: instant.$id,
    data: { cap: caption },
  });

  return { id: row.$id, caption: row.cap };
}

export async function deleteOwnedInstant(
  ownerId: string,
  instantId: string,
): Promise<void> {
  const instant = await getInstantRow(instantId);
  if (!instant) {
    return;
  }
  if (instant.user !== ownerId) {
    throw new InstantNotFoundError();
  }

  try {
    await getStorage().deleteFile({
      bucketId: getBucketId(),
      fileId: instant.image,
    });
  } catch (error) {
    if (!(error instanceof AppwriteException && error.code === 404)) {
      throw error;
    }
  }

  await getTables().deleteRow({
    databaseId: getDatabaseId(),
    tableId: "instants",
    rowId: instant.$id,
  });
}

export async function getAuthorizedInstantImage(
  instantId: string,
  viewerId: string | null,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const instant = await getInstantRow(instantId);
  if (!instant) {
    throw new InstantNotFoundError();
  }

  const owner = await getUserPrivacy(instant.user);
  if (!owner) {
    throw new InstantNotFoundError();
  }

  const isOwner = viewerId === instant.user;
  let isLinked = false;
  let isBlocked = false;

  if (viewerId && !isOwner) {
    const [link, blockForward, blockReverse] = await Promise.all([
      findLink(viewerId, instant.user),
      findBlock(viewerId, instant.user),
      findBlock(instant.user, viewerId),
    ]);
    isLinked = Boolean(link);
    isBlocked = Boolean(blockForward || blockReverse);
  }

  if (!canViewInstant(owner.private, isOwner, isLinked, isBlocked)) {
    throw new InstantNotFoundError();
  }

  const storage = getStorage();
  const bucketId = getBucketId();
  const file = await storage.getFile({ bucketId, fileId: instant.image });
  const mimeType = file.mimeType;
  if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new InstantNotFoundError();
  }
  const bytes = new Uint8Array(
    await storage.getFileView({ bucketId, fileId: instant.image }),
  );
  return { bytes, mimeType };
}

async function findBlock(
  blockerId: string,
  blockedId: string,
): Promise<Models.Row | null> {
  const result = await getTables().listRows<Models.Row>({
    databaseId: getDatabaseId(),
    tableId: "blocks",
    queries: [
      Query.equal("blocker", blockerId),
      Query.equal("blocked", blockedId),
      Query.limit(1),
    ],
    total: false,
  });
  return result.rows[0] ?? null;
}

function toCreatedInstant(row: InstantRow): CreatedInstant {
  return {
    id: row.$id,
    imageUrl: `/api/instants/${row.$id}/image`,
    caption: row.cap,
    likes: row.likes,
    createdAt: row.$createdAt,
    expires: row.expires,
  };
}

export class UnsupportedInstantImageError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class InstantConflictError extends Error {
  constructor() {
    super("This Instant identifier is already in use.");
  }
}

export { InvalidInstantImageError, UnsupportedImageError };
