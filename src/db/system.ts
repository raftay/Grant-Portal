import { sql } from "drizzle-orm";
import { database, type Database, type Tx } from "./client";

export async function withSystem<T>(
  work: (tx: Tx) => Promise<T>,
  actorId = "",
  db: Database = database("DATABASE_SYSTEM_URL"),
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${actorId}, true)`);
    return work(tx);
  });
}
