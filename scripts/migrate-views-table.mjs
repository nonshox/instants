/**
 * One-off migration: creates the `views` table — one row per viewer per
 * Instant. Powers feed filtering of seen Instants and the owner-facing
 * "Seen by" list on own Monos. Idempotent — safe to run more than once.
 *
 * Usage: node scripts/migrate-views-table.mjs
 */
import { readFileSync } from "node:fs";
import { Client, TablesDB, AppwriteException } from "node-appwrite";

function loadEnv() {
  const source = readFileSync(new URL("../.env", import.meta.url), "utf8");
  const env = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^"|"$/g, "");
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

const tableExists = async () => {
  try {
    await tables.getTable({ databaseId, tableId: "views" });
    return true;
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 404) return false;
    throw error;
  }
};

// 1. Table (skip if already present).
if (await tableExists()) {
  console.log("table 'views' already exists — skipping create");
} else {
  await tables.createTable({
    databaseId,
    tableId: "views",
    name: "views",
    rowSecurity: true,
    enabled: true,
    description: "One row per viewer per Instant; powers seen-filtering and the owner's seen-by list.",
  });
  console.log("created table 'views'");
}

// 2. Columns (skip any already present).
const existingColumns = async () => {
  const listed = await tables.listColumns({ databaseId, tableId: "views" });
  return new Set((listed.columns ?? []).map((column) => column.key));
};
const ensureColumn = async (key, create) => {
  const columns = await existingColumns();
  if (columns.has(key)) {
    console.log(`column '${key}' already exists — skipping`);
    return;
  }
  try {
    await create();
    console.log(`created column '${key}'`);
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      console.log(`column '${key}' already exists (409) — continuing`);
      return;
    }
    throw error;
  }
};

await ensureColumn("instant", () =>
  tables.createVarcharColumn({
    databaseId,
    tableId: "views",
    key: "instant",
    size: 36,
    required: true,
    description: "Instant row id",
  }),
);
await ensureColumn("user", () =>
  tables.createVarcharColumn({
    databaseId,
    tableId: "views",
    key: "user",
    size: 36,
    required: true,
    description: "Viewer id (Appwrite user id)",
  }),
);
await ensureColumn("seen", () =>
  tables.createDatetimeColumn({
    databaseId,
    tableId: "views",
    key: "seen",
    required: true,
    description: "When the viewer first dealt/reacted to the Instant",
  }),
);

// 3. Indexes (skip any already present).
const existingIndexes = async () => {
  const listed = await tables.listIndexes({ databaseId, tableId: "views" });
  return new Set((listed.indexes ?? []).map((index) => index.key));
};
const ensureIndex = async (key, create) => {
  const indexes = await existingIndexes();
  if (indexes.has(key)) {
    console.log(`index '${key}' already exists — skipping`);
    return;
  }
  try {
    await create();
    console.log(`created index '${key}'`);
  } catch (error) {
    if (error instanceof AppwriteException && error.code === 409) {
      console.log(`index '${key}' already exists (409) — continuing`);
      return;
    }
    throw error;
  }
};

await ensureIndex("instant_user_uq", () =>
  tables.createIndex({
    databaseId,
    tableId: "views",
    key: "instant_user_uq",
    type: "unique",
    columns: ["instant", "user"],
    orders: ["asc", "asc"],
  }),
);
await ensureIndex("instant_idx", () =>
  tables.createIndex({
    databaseId,
    tableId: "views",
    key: "instant_idx",
    type: "key",
    columns: ["instant"],
    orders: ["desc"],
  }),
);

console.log(`done — table 'views' ready: ${await tableExists()}`);
