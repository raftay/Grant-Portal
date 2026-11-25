import NextAuth, { CredentialsSignin, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { email as emailField } from "@/lib/validation/common";
import { deliver, recentlySent } from "../email/deliver";
import { signInEmail } from "../email/templates";
import { env } from "../env";
import { AppError } from "../errors";
import { recordSignIn } from "./accounts";
import { adapter, findActiveUser } from "./adapter";
import { verifySignIn } from "./sign-in";

class Throttled extends CredentialsSignin {
  code = "throttled";
}

const credentials = z.object({ email: emailField, password: z.string().min(1).max(128) });
const checkEmail = "/api/auth/verify-request?provider=email&type=email";

export function authConfig(): NextAuthConfig {
  return {
    secret: env().AUTH_SECRET,
    adapter,
    session: { strategy: "jwt", maxAge: 8 * 3600 },
    pages: { signIn: "/login", verifyRequest: "/login?sent=1", error: "/login" },
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        async authorize(input, request) {
          const parsed = credentials.safeParse(input);
          if (!parsed.success) return null;
          const address = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
          try {
            return (await verifySignIn(parsed.data.email, parsed.data.password, address)) ?? null;
          } catch (error) {
            if (error instanceof AppError && error.code === "throttled") throw new Throttled();
            throw error;
          }
        },
      }),
      {
        id: "email",
        type: "email",
        name: "Email",
        from: env().EMAIL_FROM,
        maxAge: 900,
        options: {},
        async sendVerificationRequest({ identifier, url }) {
          await deliver({ kind: "sign_in_link", to: identifier, ...signInEmail(url) });
        },
      },
    ],
    callbacks: {
      async signIn({ user, account, email }) {
        if (account?.type === "credentials") return true;
        if (account?.type !== "email" || !user.email) return false;
        const known = await findActiveUser(user.email);
        if (!email?.verificationRequest) return Boolean(known);
        if (!known || (await recentlySent("sign_in_link", known.email))) return checkEmail;
        return true;
      },
      jwt({ token, user }) {
        if (user?.id) {
          token.sub = user.id;
          token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion;
        }
        return token;
      },
      session({ session, token }) {
        return { expires: session.expires, user: { ...session.user, id: token.sub ?? "" }, sessionVersion: token.sessionVersion };
      },
    },
    events: {
      async signIn({ user }) {
        if (user.id) await recordSignIn(user.id);
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => authConfig());
