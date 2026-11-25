import type { Metadata } from "next";
import { chooseNewPassword } from "@/app/actions/auth";
import { AuthHeading } from "@/components/auth-heading";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";

export const metadata: Metadata = { title: "New password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <AuthHeading eyebrow="Password help" title="Choose a new password">
        This signs you out everywhere else.
      </AuthHeading>
      <ActionForm action={chooseNewPassword} submitLabel="Save password" pendingLabel="Saving" fullWidth>
        <input type="hidden" name="token" value={token} />
        <TextField name="password" label="New password" type="password" autoComplete="new-password" hint="At least 12 characters." required />
      </ActionForm>
    </>
  );
}
