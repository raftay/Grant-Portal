import { and, eq } from "drizzle-orm";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { withSystem } from "@/db/system";
import { users, verificationTokens } from "@/db/schema";

type UserRow = typeof users.$inferSelect;

const present = (row: UserRow | undefined): (AdapterUser & { sessionVersion: number }) | null =>
  row
    ? { id: row.id, name: row.name, email: row.email, emailVerified: row.emailVerified, sessionVersion: row.sessionVersion }
    : null;

export async function findActiveUser(email: string) {
  const [row] = await withSystem((tx) =>
    tx.select().from(users).where(and(eq(users.email, email.toLowerCase()), eq(users.status, "active"))),
  );
  return present(row);
}

export const adapter: Adapter = {
  createUser() {
    throw new Error("Accounts are created by invitation only");
  },
  async getUser(id) {
    const [row] = await withSystem((tx) => tx.select().from(users).where(and(eq(users.id, id), eq(users.status, "active"))));
    return present(row);
  },
  getUserByEmail: findActiveUser,
  async getUserByAccount() {
    return null;
  },
  async updateUser({ id, emailVerified }) {
    const [row] = await withSystem((tx) =>
      tx.update(users).set({ emailVerified: emailVerified ?? new Date() }).where(eq(users.id, id)).returning(),
    );
    const user = present(row);
    if (!user) throw new Error("User not found");
    return user;
  },
  async linkAccount() {
    return undefined;
  },
  async createVerificationToken(token) {
    await withSystem((tx) => tx.insert(verificationTokens).values(token));
    return token;
  },
  async useVerificationToken({ identifier, token }) {
    const [row] = await withSystem((tx) =>
      tx
        .delete(verificationTokens)
        .where(and(eq(verificationTokens.identifier, identifier), eq(verificationTokens.token, token)))
        .returning(),
    );
    return row ?? null;
  },
};
