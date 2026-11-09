/**
 * Preflight checks against the real Appwrite backend — read-only, never writes.
 * Run this BEFORE deploying to catch stale env vars, revoked keys, and DNS
 * breakage before users do.
 *
 * Usage: node scripts/preflight.mjs
 */

import { readFileSync } from "node:fs";
import { Client, TablesDB, AppwriteException, Query } from "node-appwrite";

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

const required = [
  "APPWRITE_ENDPOINT",
  "APPWRITE_PROJECT_ID",
  "APPWRITE_API_KEY",
  "APPWRITE_DATABASE_ID",
];
const missing = required.filter((key) => !env[key]);
if (missing.length > 0) {
  console.error(`Missing env values in .env: ${missing.join(", ")}`);
  process.exit(1);
}

const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const tables = new TablesDB(client);
const databaseId = env.APPWRITE_DATABASE_ID;

// Each check emits one line: OK or the exact failure the deployer will see.
const checks = [
  { name: "API key authenticates (list instants)", run: () =>
      tables.listRows({
        databaseId,
        tableId: "instants",
        queries: [Query.limit(1), Query.select(["$id"])],
        total: false,
      }),
  },
  { name: "likes table readable/has emoji column", run: async () => {
      const listed = await tables.listColumns({ databaseId, tableId: "likes" });
      const hasEmoji = listed.columns?.some((column) => column.key === "emoji");
      if (!hasEmoji) throw new Error("emoji column missing on likes table — run scripts/migrate-likes-reactions.mjs");
      return listed;
    },
  },
  { name: "views table exists", run: async () => {
      try {
        await tables.getTable({ databaseId, tableId: "views" });
      } catch (error) {
        if (error instanceof AppwriteException && error.code === 404) {
          throw new Error("views table missing — run scripts/migrate-views-table.mjs");
        }
        throw error;
      }
      return { ok: true };
    },
  },
  { name: "notifications table reachable", run: () =>
      tables.listRows({
        databaseId,
        tableId: "notifications",
        queries: [Query.limit(1), Query.select(["$id"])],
        total: false,
      }),
  },
];

const results = [];
for (const check of checks) {
  try {
    await check.run();
    results.push(`OK   ${check.name}`);
  } catch (error) {
    const detail =
      error instanceof AppwriteException ? `Appwrite ${error.code} (${error.type})` : error.message;
    results.push(`FAIL ${check.name} — ${detail}`);
  }
}

console.log(results.join("\n"));
const failures = results.filter((line) => line.startsWith("FAIL")).length;
if (failures > 0) {
  console.error(`\n${failures} check(s) failed. NOT safe to deploy yet.`);
  process.exit(1);
}
console.log("\nAll checks pass — safe to deploy.");
