import { runMigrations } from "./lib/database";

const url = process.env.DATABASE_OWNER_URL;
if (!url) throw new Error("DATABASE_OWNER_URL is required");
await runMigrations(url);
console.log("Migrations applied");
