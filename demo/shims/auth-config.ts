import { email as emailField } from "@/lib/validation/common";
import { withSystem } from "@/db/system";
import { verificationTokens, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { recordSignIn } from "@/server/auth/accounts";
import { verifySignIn } from "@/server/auth/sign-in";
import { deliver, recentlySent } from "@/server/email/deliver";
import { signInEmail } from "@/server/email/templates";
import { AppError } from "@/server/errors";
import { env } from "./env";
import { createHash, randomBytes } from "./crypto";
import { redirect } from "./navigation";
import { AuthError } from "./next-auth";

export type Session = { user: { id: string }; sessionVersion: number };

const key = "grant-portal-demo-session";

export function loadSession(): Session | null {
  const stored = sessionStorage.getItem(key);
  return stored ? (JSON.parse(stored) as Session) : null;
}

export const auth = async () => loadSession();

async function start(id: string, sessionVersion: number): Promise<void> {
  sessionStorage.setItem(key, JSON.stringify({ user: { id }, sessionVersion }));
  await recordSignIn(id);
}

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

async function activeUser(email: string) {
  const [row] = await withSystem((tx) => tx.select().from(users).where(and(eq(users.email, email), eq(users.status, "active"))));
  return row;
}

async function withPassword(email: string, password: string): Promise<void> {
  const parsed = emailField.safeParse(email);
  if (!parsed.success || !password) throw new AuthError("credentials");
  let user;
  try {
    user = await verifySignIn(parsed.data, password, "this browser");
  } catch (error) {
    if (error instanceof AppError && error.code === "throttled") throw new AuthError("throttled");
    throw error;
  }
  if (!user) throw new AuthError("credentials");
  await start(user.id, user.sessionVersion);
}

async function sendLink(email: string): Promise<void> {
  const parsed = emailField.safeParse(email);
  if (!parsed.success) return;
  const user = await activeUser(parsed.data);
  if (!user || (await recentlySent("sign_in_link", user.email))) return;
  const token = randomBytes(24).toString("base64url");
  await withSystem((tx) => tx.insert(verificationTokens).values({ identifier: user.email, token: digest(token), expires: new Date(Date.now() + 900_000) }));
  await deliver({ kind: "sign_in_link", to: user.email, idempotencyKey: crypto.randomUUID(), ...signInEmail(`${env().APP_URL}/link/${token}`) });
}

export async function followLink(token: string): Promise<boolean> {
  const [row] = await withSystem((tx) => tx.delete(verificationTokens).where(eq(verificationTokens.token, digest(token))).returning());
  if (!row || row.expires.getTime() < Date.now()) return false;
  const user = await activeUser(row.identifier);
  if (!user) return false;
  await start(user.id, user.sessionVersion);
  return true;
}

type SignInOptions = { email: string; password?: string; redirectTo: string };

export async function signIn(provider: "credentials" | "email", options: SignInOptions): Promise<never> {
  if (provider === "email") {
    await sendLink(options.email);
    redirect("/login?sent=1");
  }
  if (options.password === undefined) throw new AuthError("credentials");
  await withPassword(options.email, options.password);
  redirect(options.redirectTo);
}

export async function signOut({ redirectTo }: { redirectTo: string }): Promise<never> {
  sessionStorage.removeItem(key);
  redirect(redirectTo);
}
