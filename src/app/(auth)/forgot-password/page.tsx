import type { Metadata } from "next";
import Link from "next/link";
import { askForReset } from "@/app/actions/auth";
import { AuthHeading } from "@/components/auth-heading";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading eyebrow="Password help" title="Reset your password">
        Enter your work email. The link lasts one hour.
      </AuthHeading>
      <ActionForm action={askForReset} submitLabel="Send reset link" pendingLabel="Sending" fullWidth>
        <TextField name="email" label="Work email" type="email" autoComplete="username" required />
      </ActionForm>
      <Link href="/login" className="font-medium text-primary hover:underline">Back to sign in</Link>
    </>
  );
}
