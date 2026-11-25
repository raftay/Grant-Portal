import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { authTokens } from "@/db/schema";

export type TokenPurpose = (typeof authTokens.$inferSelect)["purpose"];

const lifetimeHours: Record<TokenPurpose, number> = { invite: 72, password_reset: 1 };

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function issueToken(tx: Tx, userId: string, purpose: TokenPurpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await retireTokens(tx, userId);
  await tx.insert(authTokens).values({
    userId,
    purpose,
    tokenHash: digest(token),
    expiresAt: new Date(Date.now() + lifetimeHours[purpose] * 3_600_000),
  });
  return token;
}

export async function consumeToken(tx: Tx, token: string, purpose: TokenPurpose): Promise<string | undefined> {
  const [row] = await tx
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, digest(token)),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: authTokens.userId });
  return row?.userId;
}

export async function retireTokens(tx: Tx, userId: string): Promise<void> {
  await tx
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.userId, userId), isNull(authTokens.usedAt)));
}
