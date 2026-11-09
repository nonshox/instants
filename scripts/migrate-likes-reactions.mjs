/**
 * One-off migration: adds a typed `emoji` reaction column to the `likes` table.
 * Existing rows become heart reactions (the default), preserving like counts.
 * Idempotent — safe to run more than once.
 *
 * Usage: node scripts/migrate-likes-reactions.mjs
 */
import { readFileSync } from "node:fs";
import { Client, TablesDB, AppwriteException, Query } from "node-appwrite";

function loadEnv() {
  const source = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const env = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
  }
  return env;
}

const env = loadEnv();
for (const key of [
  "APPWRITE_ENDPOINT",
  "APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "APPWRITE_DATABASE_ID",
]) {
  if (!env[key]) throw new Error(`${key} is missing from .env`);
}

const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const tables = new TablesDB(client);
const databaseId = env.APPWRITE_DATABASE_ID;

const hasEmojiColumn = async () => {
  const listed = await tables.listColumns({ databaseId, tableId: "likes" });
  return listed.columns?.some((column) => column.key === "emoji");
};

// 1. Add the column if it does not exist yet. Appwrite refuses a default on
// a required column, so it is created optional; the backfill below guarantees
// every row has one and the app layer enforces the whitelist.
if (await hasEmojiColumn()) {
  console.log("column 'emoji' already exists — skipping create");
} else {
  try {
    await tables.createVarcharColumn({
      databaseId,
      tableId: "likes",
      key: "emoji",
      size: 8,
      required: false,
      description: "Viewer-chosen reaction emoji (whitelist; defaults to heart)",
    });
    console.log("created column 'emoji' (varchar 8, optional until backfilled)");
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      console.log("column 'emoji' already exists (409) — continuing");
    } else {
      throw error;
    }
  }
}

// 2. Backfill rows that predate the column.
let patched = 0;
let cursor;
while (true) {
  const queries = [
    Query.select(["instant", "user", "emoji"]),
    Query.limit(100),
    ...(cursor ? [Query.cursorAfter(cursor)] : []),
  ];
  const page = await tables.listRows({
    databaseId,
    tableId: "likes",
    queries,
    total: false,
  });
  for (const row of page.rows) {
    if (typeof row.emoji !== "string" || row.emoji.length === 0) {
      await tables.updateRow({
        databaseId,
        tableId: "likes",
        rowId: row.$id,
        data: { emoji: "❤️" },
      });
      patched += 1;
    }
  }
  if (page.rows.length < 100) break;
  cursor = page.rows[page.rows.length - 1].$id;
}

console.log(
  `done — patched ${patched} row(s); emoji column present: ${await hasEmojiColumn()}`,
);
