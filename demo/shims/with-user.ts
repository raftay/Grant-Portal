import { sql } from "drizzle-orm";
import { open } from "../database";
import type { Tx } from "./client";

export type Identity = { userId: string; requestId?: string };

export async function withUser<T>(identity: Identity, work: (tx: Tx) => Promise<T>): Promise<T> {
  const { db } = await open();
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role app_user`);
    await tx.execute(sql`select set_config('app.user_id', ${identity.userId}, true), set_config('app.request_id', ${identity.requestId ?? ""}, true)`);
    return work(tx);
  });
}
