import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema> & { $client: Pool };
export type Tx = PgTransaction<NodePgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

export function connect(url: string, max = 5): Database {
  const pool = new Pool({ connectionString: url, max, idleTimeoutMillis: 10_000 });
  return drizzle(pool, { schema });
}

const cache = new Map<string, Database>();

export function database(variable: "DATABASE_URL" | "DATABASE_SYSTEM_URL"): Database {
  const existing = cache.get(variable);
  if (existing) return existing;
  const url = process.env[variable];
  if (!url) throw new Error(`${variable} is not set`);
  const created = connect(url);
  cache.set(variable, created);
  return created;
}
