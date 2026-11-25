import type { Metadata } from "next";
import { joinWorkspace } from "@/app/actions/auth";
import { AuthHeading } from "@/components/auth-heading";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/fields";

export const metadata: Metadata = { title: "Accept invitation", referrer: "no-referrer" };

export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <AuthHeading eyebrow="You are invited" title="Join your workspace">
        Set your name and a password to finish.
      </AuthHeading>
      <ActionForm action={joinWorkspace} submitLabel="Join" pendingLabel="Joining" fullWidth>
        <input type="hidden" name="token" value={token} />
        <TextField name="name" label="Your name" autoComplete="name" required />
        <TextField name="password" label="Password" type="password" autoComplete="new-password" hint="At least 12 characters." required />
      </ActionForm>
    </>
  );
}
