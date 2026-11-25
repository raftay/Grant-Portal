import { sql } from "drizzle-orm";
import { database, type Database, type Tx } from "./client";

export type Identity = { userId: string; requestId?: string };

export async function withUser<T>(
  identity: Identity,
  work: (tx: Tx) => Promise<T>,
  db: Database = database("DATABASE_URL"),
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.user_id', ${identity.userId}, true), set_config('app.request_id', ${identity.requestId ?? ""}, true)`,
    );
    return work(tx);
  });
}
