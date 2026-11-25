"use client";

import { useState } from "react";
import { invite } from "@/app/actions/records";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function InviteDialog({ full }: { full: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={full}>+ Invite person</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a person</DialogTitle>
          <DialogDescription>They get an email with a link that lasts 72 hours.</DialogDescription>
        </DialogHeader>
        <ActionForm action={invite} submitLabel="Send invitation" pendingLabel="Sending" onDone={() => setOpen(false)}>
          <TextField name="name" label="Name" required />
          <TextField name="email" label="Work email" type="email" required />
          <SelectField name="role" label="Role" defaultValue="viewer" choices={[{ value: "admin", label: "Admin" }, { value: "staff", label: "Staff" }, { value: "viewer", label: "View-only" }]} />
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
