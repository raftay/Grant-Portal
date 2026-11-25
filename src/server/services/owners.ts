import { and, eq } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { users } from "@/db/schema";
import { AppError } from "../errors";

export async function requireActiveOwner(tx: Tx, ownerId: string | null): Promise<void> {
  if (!ownerId) return;
  const [owner] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, ownerId), eq(users.status, "active")));
  if (!owner) throw new AppError("invalid", "Choose an active person as the owner.");
}
