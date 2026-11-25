import { and, eq, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { withSystem } from "@/db/system";
import { userCredentials, users } from "@/db/schema";
import { acceptInviteInput, resetPasswordInput } from "@/lib/validation/users";
import { email as emailField } from "@/lib/validation/common";
import type { z } from "zod";
import { deliver, recentlySent } from "../email/deliver";
import { inviteEmail, passwordResetEmail } from "../email/templates";
import { env } from "../env";
import { AppError, guarded } from "../errors";
import { hashPassword } from "./password";
import { consumeToken, issueToken, retireTokens } from "./tokens";

const expiredLink = () => new AppError("invalid", "This link has expired or has already been used.");

async function savePassword(tx: Tx, userId: string, passwordHash: string): Promise<void> {
  await tx
    .insert(userCredentials)
    .values({ userId, passwordHash })
    .onConflictDoUpdate({ target: userCredentials.userId, set: { passwordHash } });
}

async function logEvent(tx: Tx, event: string, userId: string): Promise<void> {
  await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
  await tx.execute(sql`select app.log_event(${event}, 'users', ${userId})`);
}

export async function sendInvite(userId: string): Promise<boolean> {
  const invite = await withSystem(async (tx) => {
    const [user] = await tx.select().from(users).where(and(eq(users.id, userId), eq(users.status, "invited"))).for("update");
    if (!user) throw new AppError("conflict", "That person has already accepted or is deactivated.");
    return { user, token: await issueToken(tx, userId, "invite") };
  });
  const link = `${env().APP_URL}/accept-invite/${invite.token}`;
  const { sent } = await deliver({ kind: "invite", to: invite.user.email, ...inviteEmail(invite.user.name, link) });
  return sent;
}

export async function acceptInvite(input: z.input<typeof acceptInviteInput>): Promise<void> {
  const { token, name, password } = acceptInviteInput.parse(input);
  const passwordHash = await hashPassword(password);
  await guarded(() =>
    withSystem(async (tx) => {
      const userId = await consumeToken(tx, token, "invite");
      if (!userId) throw expiredLink();
      const updated = await tx
        .update(users)
        .set({ name, status: "active", emailVerified: new Date() })
        .where(and(eq(users.id, userId), eq(users.status, "invited")))
        .returning({ id: users.id });
      if (updated.length === 0) throw expiredLink();
      await savePassword(tx, userId, passwordHash);
      await logEvent(tx, "auth.invite_accepted", userId);
    }),
  );
}

export async function requestPasswordReset(input: string): Promise<void> {
  const parsed = emailField.safeParse(input);
  if (!parsed.success) return;
  if (await recentlySent("password_reset", parsed.data)) return;
  const reset = await withSystem(async (tx) => {
    const [user] = await tx.select().from(users).where(and(eq(users.email, parsed.data), eq(users.status, "active")));
    return user ? { user, token: await issueToken(tx, user.id, "password_reset") } : undefined;
  });
  if (!reset) return;
  const link = `${env().APP_URL}/reset-password/${reset.token}`;
  await deliver({ kind: "password_reset", to: reset.user.email, ...passwordResetEmail(reset.user.name, link) });
}

export async function resetPassword(input: z.input<typeof resetPasswordInput>): Promise<void> {
  const { token, password } = resetPasswordInput.parse(input);
  const passwordHash = await hashPassword(password);
  await guarded(() =>
    withSystem(async (tx) => {
      const userId = await consumeToken(tx, token, "password_reset");
      if (!userId) throw expiredLink();
      const updated = await tx
        .update(users)
        .set({ sessionVersion: sql`${users.sessionVersion} + 1`, emailVerified: new Date() })
        .where(and(eq(users.id, userId), eq(users.status, "active")))
        .returning({ id: users.id });
      if (updated.length === 0) throw expiredLink();
      await savePassword(tx, userId, passwordHash);
      await retireTokens(tx, userId);
      await logEvent(tx, "auth.password_reset", userId);
    }),
  );
}

export async function recordSignIn(userId: string): Promise<void> {
  await withSystem((tx) => logEvent(tx, "auth.signed_in", userId));
}
