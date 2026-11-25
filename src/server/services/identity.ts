import { sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { withUser, type Identity } from "@/db/with-user";
import { forbidden, guarded } from "../errors";

export type { Identity } from "@/db/with-user";

export function asMember<T>(identity: Identity, work: (tx: Tx) => Promise<T>): Promise<T> {
  return guarded(() => withUser(identity, work));
}

async function requireFlag(tx: Tx, check: "is_admin" | "can_write"): Promise<void> {
  const result = await tx.execute<{ allowed: boolean }>(
    check === "is_admin" ? sql`select app.is_admin() as allowed` : sql`select app.can_write() as allowed`,
  );
  if (!result.rows[0]?.allowed) throw forbidden();
}

export function asWriter<T>(identity: Identity, work: (tx: Tx) => Promise<T>): Promise<T> {
  return asMember(identity, async (tx) => {
    await requireFlag(tx, "can_write");
    return work(tx);
  });
}

export function asAdmin<T>(identity: Identity, work: (tx: Tx) => Promise<T>): Promise<T> {
  return asMember(identity, async (tx) => {
    await requireFlag(tx, "is_admin");
    return work(tx);
  });
}
