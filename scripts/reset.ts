import { Client } from "pg";
import { runMigrations } from "./lib/database";

const url = process.env.DATABASE_OWNER_URL;
if (!url) throw new Error("DATABASE_OWNER_URL is required");
if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname)) throw new Error("Only a local database can be reset");
const client = new Client({ connectionString: url });
await client.connect();
await client.query("drop schema if exists public cascade; drop schema if exists app cascade; drop schema if exists drizzle cascade; create schema public;");
await client.end();
await runMigrations(url);
console.log("Local database reset");
