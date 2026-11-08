import "server-only";
import { AppwriteException, Storage, TablesDB, type Models } from "node-appwrite";
import {
  createAdminClient,
  getAppwriteBucketId,
  getAppwriteDatabaseId,
} from "@/src/lib/appwrite/server";

export type InstantRow = Models.Row & {
  user: string;
  image: string;
  expires: string;
  likes: number;
  cap: string;
};

export type LinkRow = Models.Row & {
  follower: string;
  following: string;
};

export type BlockRow = Models.Row & {
  blocker: string;
  blocked: string;
};

export type UserPrivacyRow = Models.Row & {
  username: string;
  avatar: string;
  private: boolean;
};

export const getTables = () => new TablesDB(createAdminClient());
export const getStorage = () => new Storage(createAdminClient());
export const getDatabaseId = () => getAppwriteDatabaseId();
export const getBucketId = () => getAppwriteBucketId();

export async function getInstantRow(
  instantId: string,
): Promise<InstantRow | null> {
  try {
    return await getTables().getRow<InstantRow>({
      databaseId: getDatabaseId(),
      tableId: "instants",
      rowId: instantId,
    });
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return null;
    }
    throw error;
  }
}

export async function getUserPrivacy(
  userId: string,
): Promise<UserPrivacyRow | null> {
  try {
    return await getTables().getRow<UserPrivacyRow>({
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
