import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/db/client";
import { deadlines, documents, documentVersions, files, grantContacts, grantLinks, grants, users } from "@/db/schema";
import { one } from "@/lib/one";
import { contactInput, grantInput, linkInput } from "@/lib/validation/grants";
import { notFound } from "../errors";
import { asMember, asWriter, type Identity } from "./identity";
import { requireActiveOwner } from "./owners";

export const spending = { available: false, reason: "Available with budgets and receipts in Phase 2" } as const;

const nextDeadline = sql<string | null>`(
  select min(d.due_on)::text from ${deadlines} d
  where d.grant_id = ${sql.raw('"grants"."id"')} and d.status in ('open', 'in_progress')
)`;

export function listGrants(identity: Identity) {
  return asMember(identity, (tx) =>
    tx
      .select({
        id: grants.id,
        name: grants.name,
        code: grants.code,
        funderName: grants.funderName,
        awardCents: grants.awardCents,
        startsOn: grants.startsOn,
        endsOn: grants.endsOn,
        status: grants.status,
        ownerName: users.name,
        nextDeadlineOn: nextDeadline,
      })
      .from(grants)
      .leftJoin(users, eq(users.id, grants.ownerId))
      .orderBy(asc(grants.sortOrder), asc(grants.name)),
  );
}

async function findContract(tx: Tx, grantId: string) {
  const [contract] = await tx
    .select({
      documentId: documents.id,
      title: documents.title,
      versionNo: documentVersions.versionNo,
      fileId: files.id,
      fileName: files.originalName,
      uploadedAt: documentVersions.createdAt,
      uploadedBy: users.name,
    })
    .from(documents)
    .innerJoin(documentVersions, eq(documentVersions.documentId, documents.id))
    .innerJoin(files, eq(files.id, documentVersions.fileId))
    .leftJoin(users, eq(users.id, documentVersions.uploadedBy))
    .where(and(eq(documents.grantId, grantId), eq(documents.category, "executed_contract"), isNull(documents.archivedAt)))
    .orderBy(desc(documentVersions.versionNo))
    .limit(1);
  return contract;
}

export async function requireContract(tx: Tx, grantId: string) {
  const contract = await findContract(tx, grantId);
  if (!contract) throw notFound("An executed contract for that grant");
  return contract;
}

export function getGrant(identity: Identity, grantId: string) {
  const id = z.uuid().parse(grantId);
  return asMember(identity, async (tx) => {
    const [row] = await tx
      .select({ grant: grants, ownerName: users.name, ownerRole: users.role, nextDeadlineOn: nextDeadline })
      .from(grants)
      .leftJoin(users, eq(users.id, grants.ownerId))
      .where(eq(grants.id, id));
    if (!row) throw notFound("That grant");
    const { grant, ...related } = row;
    return {
      ...grant,
      ...related,
      contract: await findContract(tx, id),
      contacts: await tx
        .select()
        .from(grantContacts)
        .where(eq(grantContacts.grantId, id))
        .orderBy(desc(grantContacts.isPrimary), asc(grantContacts.name)),
      links: await tx.select().from(grantLinks).where(eq(grantLinks.grantId, id)).orderBy(asc(grantLinks.label)),
      upcoming: await tx
        .select({
          id: deadlines.id,
          title: deadlines.title,
          type: deadlines.type,
          dueOn: deadlines.dueOn,
          status: deadlines.status,
          ownerName: users.name,
        })
        .from(deadlines)
        .leftJoin(users, eq(users.id, deadlines.ownerId))
        .where(and(eq(deadlines.grantId, id), inArray(deadlines.status, ["open", "in_progress"])))
        .orderBy(asc(deadlines.dueOn))
        .limit(5),
      spending,
    };
  });
}

export function createGrant(identity: Identity, input: z.input<typeof grantInput>): Promise<string> {
  const values = grantInput.parse(input);
  return asWriter(identity, async (tx) => {
    await requireActiveOwner(tx, values.ownerId);
    return one(await tx.insert(grants).values(values).returning({ id: grants.id })).id;
  });
}

export async function lockGrant(tx: Tx, grantId: string) {
  const [grant] = await tx.select().from(grants).where(eq(grants.id, grantId)).for("update");
  if (!grant) throw notFound("That grant");
  return grant;
}

export function updateGrant(identity: Identity, grantId: string, input: z.input<typeof grantInput>): Promise<void> {
  const id = z.uuid().parse(grantId);
  const values = grantInput.parse(input);
  return asWriter(identity, async (tx) => {
    const existing = await lockGrant(tx, id);
    if (existing.ownerId !== values.ownerId) await requireActiveOwner(tx, values.ownerId);
    await tx.update(grants).set(values).where(eq(grants.id, id));
  });
}

async function clearOtherPrimary(tx: Tx, grantId: string, keepId?: string): Promise<void> {
  await tx
    .update(grantContacts)
    .set({ isPrimary: false })
    .where(
      and(eq(grantContacts.grantId, grantId), eq(grantContacts.isPrimary, true), keepId ? ne(grantContacts.id, keepId) : undefined),
    );
}

export function addContact(identity: Identity, grantId: string, input: z.input<typeof contactInput>): Promise<string> {
  const id = z.uuid().parse(grantId);
  const values = contactInput.parse(input);
  return asWriter(identity, async (tx) => {
    await lockGrant(tx, id);
    if (values.isPrimary) await clearOtherPrimary(tx, id);
    return one(await tx.insert(grantContacts).values({ ...values, grantId: id }).returning({ id: grantContacts.id })).id;
  });
}

export function updateContact(identity: Identity, contactId: string, input: z.input<typeof contactInput>): Promise<void> {
  const id = z.uuid().parse(contactId);
  const values = contactInput.parse(input);
  return asWriter(identity, async (tx) => {
    const [contact] = await tx.select().from(grantContacts).where(eq(grantContacts.id, id));
    if (!contact) throw notFound("That contact");
    await lockGrant(tx, contact.grantId);
    if (values.isPrimary) await clearOtherPrimary(tx, contact.grantId, id);
    one(await tx.update(grantContacts).set(values).where(eq(grantContacts.id, id)).returning({ id: grantContacts.id }));
  });
}

export function removeContact(identity: Identity, contactId: string): Promise<void> {
  const id = z.uuid().parse(contactId);
  return asWriter(identity, async (tx) => {
    const removed = await tx.delete(grantContacts).where(eq(grantContacts.id, id)).returning({ id: grantContacts.id });
    if (removed.length === 0) throw notFound("That contact");
  });
}

export function addLink(identity: Identity, grantId: string, input: z.input<typeof linkInput>): Promise<string> {
  const id = z.uuid().parse(grantId);
  const values = linkInput.parse(input);
  return asWriter(identity, async (tx) =>
    one(await tx.insert(grantLinks).values({ ...values, grantId: id }).returning({ id: grantLinks.id })).id,
  );
}

export function updateLink(identity: Identity, linkId: string, input: z.input<typeof linkInput>): Promise<void> {
  const id = z.uuid().parse(linkId);
  const values = linkInput.parse(input);
  return asWriter(identity, async (tx) => {
    const updated = await tx.update(grantLinks).set(values).where(eq(grantLinks.id, id)).returning({ id: grantLinks.id });
    if (updated.length === 0) throw notFound("That link");
  });
}

export function removeLink(identity: Identity, linkId: string): Promise<void> {
  const id = z.uuid().parse(linkId);
  return asWriter(identity, async (tx) => {
    const removed = await tx.delete(grantLinks).where(eq(grantLinks.id, id)).returning({ id: grantLinks.id });
    if (removed.length === 0) throw notFound("That link");
  });
}
