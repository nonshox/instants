import "server-only";
import { randomUUID } from "node:crypto";
import { AppwriteException, TablesDB, type Models } from "node-appwrite";
import {
  createAdminClient,
  getAppwriteDatabaseId,
} from "@/src/lib/appwrite/server";

const tableId = "users";

type ProfileRow = Models.Row & {
  username: string;
  name: string;
  bio: string;
  avatar: string;
  private: boolean;
  links: number;
  likes: number;
  email: string;
};

export type ProfileView = Pick<
  ProfileRow,
  "username" | "name" | "bio" | "avatar" | "private"
>;

type ProfileInput = Omit<ProfileView, "avatar">;

function getTables(): TablesDB {
  return new TablesDB(createAdminClient());
}

function toProfileView(row: ProfileRow): ProfileView {
  return {
    username: row.username,
    name: row.name,
    bio: row.bio,
    avatar: row.avatar,
    private: row.private,
  };
}

export async function getProfileForAccount(
  userId: string,
  authEmail: string,
): Promise<ProfileView | null> {
  const tables = getTables();

  try {
    const row = await tables.getRow<ProfileRow>({
      databaseId: getAppwriteDatabaseId(),
      tableId,
      rowId: userId,
    });

    if (row.email !== authEmail) {
      await tables.updateRow<ProfileRow>({
        databaseId: getAppwriteDatabaseId(),
        tableId,
        rowId: userId,
        data: { email: authEmail },
      });
    }

    return toProfileView(row);
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) {
      return null;
    }

    throw error;
  }
}

export async function createProfileForAccount(
  userId: string,
  authEmail: string,
  input: ProfileInput,
): Promise<ProfileView> {
  const row = await getTables().createRow<ProfileRow>({
    databaseId: getAppwriteDatabaseId(),
    tableId,
    rowId: userId,
    permissions: [],
    data: {
      ...input,
      avatar: "",
      links: 0,
      likes: 0,
      email: authEmail,
    },
  });

  return toProfileView(row);
}

export async function ensureProfileForAccount(
  userId: string,
  authEmail: string,
): Promise<ProfileView> {
  const existing = await getProfileForAccount(userId, authEmail);
  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await createProfileForAccount(userId, authEmail, {
        username: `user_${randomUUID().replaceAll("-", "").slice(0, 24)}`,
        name: "",
        bio: "",
        private: true,
      });
    } catch (error) {
      if (!(error instanceof AppwriteException && error.code === 409)) {
        throw error;
      }

      const createdByAnotherRequest = await getProfileForAccount(
        userId,
        authEmail,
      );
      if (createdByAnotherRequest) {
        return createdByAnotherRequest;
      }
    }
  }

  throw new Error("Could not create a unique default username.");
}

export async function updateProfileForAccount(
  userId: string,
  authEmail: string,
  input: ProfileInput,
): Promise<ProfileView | null> {
  const existing = await getProfileForAccount(userId, authEmail);

  if (!existing) {
    return null;
  }

  const row = await getTables().updateRow<ProfileRow>({
    databaseId: getAppwriteDatabaseId(),
    tableId,
    rowId: userId,
    data: {
      ...input,
      email: authEmail,
    },
  });

  return toProfileView(row);
}
