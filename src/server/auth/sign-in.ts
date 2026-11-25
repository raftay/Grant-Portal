import { createHmac } from "node:crypto";
import { and, count, eq, gt, lt, sql } from "drizzle-orm";
import { withSystem } from "@/db/system";
import { loginAttempts, userCredentials, users } from "@/db/schema";
import { one } from "@/lib/one";
import { env } from "../env";
import { AppError } from "../errors";
import { burnPasswordCheck, verifyPassword } from "./password";

const windowMinutes = 15;
const maxPerEmail = 5;
const maxPerAddress = 20;

const keyed = (value: string) => createHmac("sha256", env().AUTH_SECRET).update(value).digest("hex");

export type SignedInUser = { id: string; name: string; email: string; sessionVersion: number };

export async function verifySignIn(email: string, password: string, address: string): Promise<SignedInUser | undefined> {
  const emailHash = keyed(`email:${email}`);
  const ipHash = keyed(`ip:${address}`);
  const since = new Date(Date.now() - windowMinutes * 60_000);

  const found = await withSystem(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(740002, hashtext(${emailHash}))`);
    const failures = async (condition: ReturnType<typeof eq>) => {
      const rows = await tx
        .select({ n: count() })
        .from(loginAttempts)
        .where(and(condition, eq(loginAttempts.succeeded, false), gt(loginAttempts.attemptedAt, since)));
      return one(rows).n;
    };
    const blocked =
      (await failures(eq(loginAttempts.emailHash, emailHash))) >= maxPerEmail ||
      (await failures(eq(loginAttempts.ipHash, ipHash))) >= maxPerAddress;
    if (blocked) throw new AppError("throttled", "Too many attempts. Try again in 15 minutes.");
    await tx.insert(loginAttempts).values({ emailHash, ipHash, succeeded: false });
    const [row] = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        sessionVersion: users.sessionVersion,
        passwordHash: userCredentials.passwordHash,
      })
      .from(users)
      .innerJoin(userCredentials, eq(userCredentials.userId, users.id))
      .where(and(eq(users.email, email), eq(users.status, "active")));
    return row;
  });

  if (!found) {
    await burnPasswordCheck(password);
    return undefined;
  }
  const { passwordHash, ...user } = found;
  if (!(await verifyPassword(password, passwordHash))) return undefined;

  await withSystem(async (tx) => {
    await tx.delete(loginAttempts).where(eq(loginAttempts.emailHash, emailHash));
    await tx.insert(loginAttempts).values({ emailHash, ipHash, succeeded: true });
    await tx.delete(loginAttempts).where(lt(loginAttempts.attemptedAt, new Date(Date.now() - 30 * 86_400_000)));
  });
  return user;
}
