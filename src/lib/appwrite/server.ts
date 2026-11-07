import { Client } from "node-appwrite";

type PublicAppwriteConfig = {
  endpoint: string;
  projectId: string;
};

function getPublicConfig(): PublicAppwriteConfig {
  const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } = process.env;

  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID) {
    throw new Error("Appwrite endpoint and project ID are required.");
  }

  return {
    endpoint: APPWRITE_ENDPOINT,
    projectId: APPWRITE_PROJECT_ID,
  };
}

export function createAccountClient(sessionSecret?: string): Client {
  const { endpoint, projectId } = getPublicConfig();
  const client = new Client().setEndpoint(endpoint).setProject(projectId);

  if (sessionSecret) {
    client.setSession(sessionSecret);
  }

  return client;
}

export function createAdminClient(): Client {
  const { endpoint, projectId } = getPublicConfig();
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!apiKey) {
    throw new Error("APPWRITE_API_KEY is required for server operations.");
  }

  return new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
}

export function getSessionCookieName(): string {
  const { projectId } = getPublicConfig();
  return `a_session_${projectId}`;
}

export function getAppwriteDatabaseId(): string {
  const databaseId = process.env.APPWRITE_DATABASE_ID;

  if (!databaseId) {
    throw new Error("APPWRITE_DATABASE_ID is required for data operations.");
  }

  return databaseId;
}

export function getAppwriteBucketId(): string {
  const bucketId = process.env.APPWRITE_STORAGE_BUCKET_ID;

  if (!bucketId) {
    throw new Error("APPWRITE_STORAGE_BUCKET_ID is required for file operations.");
  }

  return bucketId;
}
