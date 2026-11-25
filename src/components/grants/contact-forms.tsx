"use client";

import { useState } from "react";
import { deleteContact, deleteLink, saveContact, saveLink } from "@/app/actions/records";
import { ToneBadge } from "@/components/badges";
import { ActionForm } from "@/components/forms/action-form";
import { CheckField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/quick";
import { Empty } from "@/components/panels";
import { Button } from "@/components/ui/button";

type Contact = { id: string; name: string; title: string | null; agency: string | null; email: string | null; phone: string | null; isPrimary: boolean };
type Link = { id: string; label: string; url: string };

const text = (value: string | null | undefined) => (value ? value : "");

function ContactForm({ grantId, contact, onClose }: { grantId: string; contact?: Contact; onClose: () => void }) {
  return (
    <ActionForm action={saveContact} submitLabel="Save contact" pendingLabel="Saving" onDone={onClose} secondary={<Button type="button" variant="outline" onClick={onClose}>Cancel</Button>} className="rounded-lg border bg-muted p-4">
      <input type="hidden" name="grantId" value={grantId} />
      <input type="hidden" name="id" value={text(contact?.id)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Name" defaultValue={text(contact?.name)} required />
        <TextField name="title" label="Title" defaultValue={text(contact?.title)} />
        <TextField name="agency" label="Agency" defaultValue={text(contact?.agency)} />
        <TextField name="email" label="Email" type="email" defaultValue={text(contact?.email)} />
        <TextField name="phone" label="Phone" type="tel" defaultValue={text(contact?.phone)} />
      </div>
      <CheckField name="isPrimary" label="Main contact for this grant" defaultChecked={contact?.isPrimary} />
    </ActionForm>
  );
}

export function Contacts({ grantId, contacts, canWrite }: { grantId: string; contacts: Contact[]; canWrite: boolean }) {
  const [open, setOpen] = useState("");
  return (
    <div className="flex flex-col gap-3">
      {contacts.length === 0 && open !== "new" && <Empty>No contacts yet.</Empty>}
      {contacts.map((contact) =>
        open === contact.id ? (
          <ContactForm key={contact.id} grantId={grantId} contact={contact} onClose={() => setOpen("")} />
        ) : (
          <div key={contact.id} className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-semibold">{contact.name} {contact.isPrimary && <ToneBadge tone="mint">Main contact</ToneBadge>}</p>
              <p className="text-xs text-muted-foreground">{[contact.title, contact.agency].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 break-words text-muted-foreground">{[contact.email, contact.phone].filter(Boolean).join(" · ")}</p>
            </div>
            {canWrite && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(contact.id)}>Edit</Button>
                <ActionButton action={deleteContact} values={{ id: contact.id }} label="Remove" pendingLabel="Removing" confirm={{ title: `Remove ${contact.name}?`, body: "The removal is kept in the audit log." }} />
              </div>
            )}
          </div>
        ),
      )}
      {open === "new" && <ContactForm grantId={grantId} onClose={() => setOpen("")} />}
      {canWrite && open !== "new" && <Button type="button" variant="outline" className="self-start" onClick={() => setOpen("new")}>+ Add contact</Button>}
    </div>
  );
}

function LinkForm({ grantId, link, onClose }: { grantId: string; link?: Link; onClose: () => void }) {
  return (
    <ActionForm action={saveLink} submitLabel="Save link" pendingLabel="Saving" onDone={onClose} secondary={<Button type="button" variant="outline" onClick={onClose}>Cancel</Button>} className="rounded-lg border bg-muted p-4">
      <input type="hidden" name="grantId" value={grantId} />
      <input type="hidden" name="id" value={text(link?.id)} />
      <TextField name="label" label="Label" defaultValue={text(link?.label)} placeholder="Open funder portal" required />
      <TextField name="url" label="Web address" type="url" defaultValue={text(link?.url)} placeholder="https://" required />
    </ActionForm>
  );
}

export function Links({ grantId, links, canWrite }: { grantId: string; links: Link[]; canWrite: boolean }) {
  const [open, setOpen] = useState("");
  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 && open !== "new" && <Empty>No links yet.</Empty>}
      {links.map((link) =>
        open === link.id ? (
          <LinkForm key={link.id} grantId={grantId} link={link} onClose={() => setOpen("")} />
        ) : (
          <div key={link.id} className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
            <div className="min-w-0">
              <p className="font-semibold">{link.label}</p>
              <a href={link.url} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{link.url}</a>
            </div>
            {canWrite && (
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(link.id)}>Edit</Button>
                <ActionButton action={deleteLink} values={{ id: link.id }} label="Remove" pendingLabel="Removing" confirm={{ title: `Remove ${link.label}?`, body: "The removal is kept in the audit log." }} />
              </div>
            )}
          </div>
        ),
      )}
      {open === "new" && <LinkForm grantId={grantId} onClose={() => setOpen("")} />}
      {canWrite && open !== "new" && <Button type="button" variant="outline" className="self-start" onClick={() => setOpen("new")}>+ Add link</Button>}
    </div>
  );
}
