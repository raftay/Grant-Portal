import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { linkSignIn, passwordSignIn } from "@/app/actions/auth";
import { AuthHeading } from "@/components/auth-heading";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";
import { Notice } from "@/components/panels";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Sign in" };

type Search = Promise<{ sent?: string; reset?: string; joined?: string; error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: Search }) {
  const { sent, reset, joined, error } = await searchParams;
  if (await currentUser()) redirect("/");
  return (
    <>
      <AuthHeading eyebrow="Welcome back" title="Sign in to your workspace">
        Use the email address your administrator invited.
      </AuthHeading>
      {sent && <Notice title="Check your email">If that address has an account, a sign-in link is on its way. It works once and lasts 15 minutes.</Notice>}
      {reset && <Notice title="Password changed">Sign in with your new password.</Notice>}
      {joined && <Notice title="You are in">Your account is ready. Sign in to continue.</Notice>}
      {error && <Notice tone="warn" title={error === "Verification" ? "That sign-in link has expired or was already used." : "Sign-in did not work."} />}
      <ActionForm action={passwordSignIn} submitLabel="Sign in" pendingLabel="Signing in" fullWidth>
        <TextField name="email" label="Work email" type="email" autoComplete="username" placeholder="you@example.org" required />
        <TextField name="password" label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" required />
        <Link href="/forgot-password" className="self-start font-medium text-primary hover:underline">
          Forgot password?
        </Link>
      </ActionForm>
      <details className="rounded-[7px] border px-4 py-3">
        <summary className="cursor-pointer list-none text-center font-semibold [&::-webkit-details-marker]:hidden">Email me a sign-in link</summary>
        <div className="pt-4">
          <ActionForm action={linkSignIn} submitLabel="Send link" pendingLabel="Sending" fullWidth>
            <TextField name="email" label="Work email for the link" type="email" autoComplete="username" placeholder="you@example.org" required />
          </ActionForm>
        </div>
      </details>
      <p className="text-muted-foreground">No account? Ask your organisation’s Admin for an invitation.</p>
      <Notice tone="ai" title="Your information stays private">
        Only authorised team members can access your organisation’s records.
      </Notice>
    </>
  );
}
