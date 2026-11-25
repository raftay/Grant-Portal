import { sql } from "drizzle-orm";
import { open } from "../database";
import type { Tx } from "./client";

let active: Tx | undefined;

export async function withSystem<T>(work: (tx: Tx) => Promise<T>, actorId = ""): Promise<T> {
  if (active) return work(active);
  const { db } = await open();
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role app_system`);
    await tx.execute(sql`select set_config('app.user_id', ${actorId}, true)`);
    active = tx;
    try {
      return await work(tx);
    } finally {
      active = undefined;
    }
  });
}
