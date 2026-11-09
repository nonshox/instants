/**
 * Read-only probe: confirms the expiry filter the feed query now uses.
 * Imports the same .env the app uses. Never writes.
 *
 * Usage: node scripts/verify-feed-algorithm.mjs
 */

import { readFileSync } from "node:fs";
import { Client, TablesDB, Query } from "node-appwrite";

const source = readFileSync(new URL("../.env", import.meta.url), "utf8");
const env = {};
for (const line of source.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, "");
}

const client = new Client()
  .setEndpoint(env.APPWRITE_ENDPOINT)
  .setProject(env.APPWRITE_PROJECT_ID)
  .setKey(env.APPWRITE_API_KEY);
const tables = new TablesDB(client);

const cutoff = new Date().toISOString();
const fresh = await tables.listRows({
  databaseId: env.APPWRITE_DATABASE_ID,
  tableId: "instants",
  queries: [
    Query.greaterThan("expires", cutoff),
    Query.orderDesc("expires"),
    Query.limit(3),
    Query.select(["$id", "expires"]),
  ],
  total: true,
});

console.log(`Live unexpired instants (approx): ${fresh.total}`);
console.log(
  "Samples:",
  JSON.stringify(fresh.rows.map((row) => ({ id: row.$id, expires: row.expires })), null, 2),
);
