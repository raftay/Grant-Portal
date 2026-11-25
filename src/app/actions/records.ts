"use server";

import { redirect } from "next/navigation";
import { actor, field, submit, ticked, type FormState } from "@/server/action";
import { AppError } from "@/server/errors";
import { parseDollars } from "@/lib/money";
import type { z } from "zod";
import type { grantInput } from "@/lib/validation/grants";
import type { deadlineInput } from "@/lib/validation/deadlines";
import { createDeadline, updateDeadline } from "@/server/services/deadlines";
import { archiveDocument, updateDocument } from "@/server/services/documents";
import { addContact, addLink, createGrant, removeContact, removeLink, updateContact, updateGrant, updateLink } from "@/server/services/grants";
import { saveOrganization } from "@/server/services/organization";
import { runAlertsNow } from "@/server/services/alerts";
import { changeRole, deactivateUser, inviteUser, reactivateUser, resendInvite, setPayrollAccess } from "@/server/services/users";

function dollars(form: FormData, name: string): number {
  const cents = parseDollars(field(form, name));
  if (cents === undefined) throw new AppError("invalid", "Enter the amount in dollars, such as 150,000.00.");
  return cents;
}

export async function saveProfile(_state: FormState, form: FormData): Promise<FormState> {
  const result = await submit(async () => {
    await saveOrganization(await actor(), {
      legalName: field(form, "legalName"),
      ein: field(form, "ein"),
      addressLine1: field(form, "addressLine1"),
      addressLine2: field(form, "addressLine2"),
      city: field(form, "city"),
      state: field(form, "state"),
      postalCode: field(form, "postalCode"),
      fiscalYearStartMonth: field(form, "fiscalYearStartMonth"),
      fiscalYearStartDay: field(form, "fiscalYearStartDay"),
      signerName: field(form, "signerName"),
      signerTitle: field(form, "signerTitle"),
      signerEmail: field(form, "signerEmail"),
      timezone: field(form, "timezone"),
    });
    return "";
  });
  if (result.status === "done") redirect("/organisation");
  return result;
}

const grantValues = (form: FormData) =>
  ({
    name: field(form, "name"),
    code: field(form, "code"),
    funderName: field(form, "funderName"),
    awardNumber: field(form, "awardNumber"),
    awardCents: dollars(form, "award"),
    awardedOn: field(form, "awardedOn"),
    startsOn: field(form, "startsOn"),
    endsOn: field(form, "endsOn"),
    purpose: field(form, "purpose"),
    ownerId: field(form, "ownerId"),
    status: field(form, "status") as z.input<typeof grantInput>["status"],
    termsText: field(form, "termsText"),
    sortOrder: Number(field(form, "sortOrder")),
  }) satisfies z.input<typeof grantInput>;

export async function addGrant(_state: FormState, form: FormData): Promise<FormState> {
  let id = "";
  const result = await submit(async () => {
    id = await createGrant(await actor(), grantValues(form));
    return "";
  });
  if (result.status === "done") redirect(`/grants/${id}`);
  return result;
}

export async function editGrant(_state: FormState, form: FormData): Promise<FormState> {
  const id = field(form, "id");
  const result = await submit(async () => {
    await updateGrant(await actor(), id, grantValues(form));
    return "";
  });
  if (result.status === "done") redirect(`/grants/${id}`);
  return result;
}

const contactValues = (form: FormData) => ({
  name: field(form, "name"),
  title: field(form, "title"),
  agency: field(form, "agency"),
  email: field(form, "email"),
  phone: field(form, "phone"),
  isPrimary: ticked(form, "isPrimary"),
});

export async function saveContact(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    const id = field(form, "id");
    if (id) await updateContact(await actor(), id, contactValues(form));
    else await addContact(await actor(), field(form, "grantId"), contactValues(form));
    return "Contact saved.";
  });
}

export async function deleteContact(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    await removeContact(await actor(), field(form, "id"));
    return "";
  });
}

export async function saveLink(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    const id = field(form, "id");
    const values = { label: field(form, "label"), url: field(form, "url") };
    if (id) await updateLink(await actor(), id, values);
    else await addLink(await actor(), field(form, "grantId"), values);
    return "Link saved.";
  });
}

export async function deleteLink(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    await removeLink(await actor(), field(form, "id"));
    return "";
  });
}

export async function saveDeadline(_state: FormState, form: FormData): Promise<FormState> {
  const returnTo = field(form, "returnTo");
  if (!/^\/(deadlines|grants\/[0-9a-f-]{36}\/deadlines)(\?[\w=&-]*)?$/.test(returnTo)) throw new Error("Unexpected return address");
  const result = await submit(async () => {
    const id = field(form, "id");
    const values: z.input<typeof deadlineInput> = {
      grantId: field(form, "grantId"),
      type: field(form, "type") as z.input<typeof deadlineInput>["type"],
      title: field(form, "title"),
      description: field(form, "description"),
      dueOn: field(form, "dueOn"),
      ownerId: field(form, "ownerId"),
      status: field(form, "status") as z.input<typeof deadlineInput>["status"],
      reminderDays: Number(field(form, "reminderDays")),
    };
    if (id) await updateDeadline(await actor(), id, values);
    else await createDeadline(await actor(), values);
    return "";
  });
  if (result.status === "done") redirect(returnTo);
  return result;
}

export async function saveDocument(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    await updateDocument(await actor(), field(form, "id"), {
      title: field(form, "title"),
      category: field(form, "category") as "other",
      expiresOn: field(form, "expiresOn"),
      reviewOn: field(form, "reviewOn"),
      ownerId: field(form, "ownerId"),
      notes: field(form, "notes"),
    });
    return "Document saved.";
  });
}

export async function retireDocument(_state: FormState, form: FormData): Promise<FormState> {
  const result = await submit(async () => {
    await archiveDocument(await actor(), field(form, "id"));
    return "";
  });
  if (result.status === "done") redirect(field(form, "grantId") ? `/grants/${field(form, "grantId")}/documents` : "/organisation/documents");
  return result;
}

export async function invite(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    await inviteUser(await actor(), { name: field(form, "name"), email: field(form, "email"), role: field(form, "role") as "viewer" });
    return "Invitation sent.";
  });
}

export async function reinvite(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    await resendInvite(await actor(), field(form, "id"));
    return "Sent again.";
  });
}

export async function setRole(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    await changeRole(await actor(), field(form, "id"), field(form, "value") as "viewer");
    return "";
  });
}

export async function setPayroll(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    await setPayrollAccess(await actor(), field(form, "id"), field(form, "value") === "true");
    return "";
  });
}

export async function setActive(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    const id = field(form, "id");
    if (field(form, "value") === "true") await reactivateUser(await actor(), id);
    else await deactivateUser(await actor(), id);
    return "";
  });
}

export async function runAlerts(): Promise<FormState> {
  return submit(async () => {
    const result = await runAlertsNow(await actor());
    return `${result.sent} sent, ${result.alreadySent} already sent.`;
  });
}
