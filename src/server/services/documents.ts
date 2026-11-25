import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/db/client";
import { documents, documentVersions, files, users } from "@/db/schema";
import { documentState } from "@/lib/dates";
import { one } from "@/lib/one";
import { createDocumentInput, documentDetails } from "@/lib/validation/documents";
import { AppError, notFound } from "../errors";
import { asMember, asWriter, type Identity } from "./identity";
import { organizationToday } from "./organization";
import { requireActiveOwner } from "./owners";

async function requireReadyFile(tx: Tx, fileId: string, userId: string): Promise<void> {
  const [file] = await tx
    .select({ id: files.id })
    .from(files)
    .where(
      and(eq(files.id, fileId), eq(files.status, "ready"), eq(files.sensitivity, "general"), eq(files.uploadedBy, userId)),
    );
  if (!file) throw new AppError("invalid", "Upload the file before saving the document.");
}

export async function insertDocument(tx: Tx, identity: Identity, input: z.output<typeof createDocumentInput>): Promise<string> {
  const { fileId, ...values } = input;
  await requireReadyFile(tx, fileId, identity.userId);
  await requireActiveOwner(tx, values.ownerId);
  const { id } = one(await tx.insert(documents).values(values).returning({ id: documents.id }));
  await tx.insert(documentVersions).values({ documentId: id, versionNo: 1, fileId });
  return id;
}

export function createDocument(identity: Identity, input: z.input<typeof createDocumentInput>): Promise<string> {
  const values = createDocumentInput.parse(input);
  return asWriter(identity, (tx) => insertDocument(tx, identity, values));
}

export function replaceDocumentFile(identity: Identity, documentId: string, fileId: string): Promise<number> {
  const id = z.uuid().parse(documentId);
  const file = z.uuid().parse(fileId);
  return asWriter(identity, async (tx) => {
    const [document] = await tx
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, id), isNull(documents.archivedAt)))
      .for("update");
    if (!document) throw notFound("That document");
    await requireReadyFile(tx, file, identity.userId);
    const latest = await tx
      .select({ n: sql<number>`max(${documentVersions.versionNo})::int` })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, id));
    const versionNo = one(latest).n + 1;
    await tx.insert(documentVersions).values({ documentId: id, versionNo, fileId: file });
    return versionNo;
  });
}

export function updateDocument(identity: Identity, documentId: string, input: z.input<typeof documentDetails>): Promise<void> {
  const id = z.uuid().parse(documentId);
  const values = documentDetails.parse(input);
  return asWriter(identity, async (tx) => {
    const [existing] = await tx
      .select({ ownerId: documents.ownerId })
      .from(documents)
      .where(and(eq(documents.id, id), isNull(documents.archivedAt)))
      .for("update");
    if (!existing) throw notFound("That document");
    if (values.ownerId !== existing.ownerId) await requireActiveOwner(tx, values.ownerId);
    await tx.update(documents).set(values).where(eq(documents.id, id));
  });
}

export function archiveDocument(identity: Identity, documentId: string): Promise<void> {
  const id = z.uuid().parse(documentId);
  return asWriter(identity, async (tx) => {
    const updated = await tx
      .update(documents)
      .set({ archivedAt: new Date() })
      .where(and(eq(documents.id, id), isNull(documents.archivedAt)))
      .returning({ id: documents.id });
    if (updated.length === 0) throw notFound("That document");
  });
}

export function listDocuments(identity: Identity, scope: { grantId: string | null }) {
  return asMember(identity, async (tx) => {
    const today = await organizationToday(tx);
    const latest = tx
      .selectDistinctOn([documentVersions.documentId], {
        documentId: documentVersions.documentId,
        versionNo: documentVersions.versionNo,
        fileId: documentVersions.fileId,
        uploadedAt: documentVersions.createdAt,
      })
      .from(documentVersions)
      .orderBy(documentVersions.documentId, desc(documentVersions.versionNo))
      .as("latest");
    const rows = await tx
      .select({
        id: documents.id,
        grantId: documents.grantId,
        title: documents.title,
        category: documents.category,
        expiresOn: documents.expiresOn,
        reviewOn: documents.reviewOn,
        ownerId: documents.ownerId,
        ownerName: users.name,
        versionNo: latest.versionNo,
        fileId: latest.fileId,
        fileName: files.originalName,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        uploadedAt: latest.uploadedAt,
      })
      .from(documents)
      .leftJoin(latest, eq(latest.documentId, documents.id))
      .leftJoin(files, eq(files.id, latest.fileId))
      .leftJoin(users, eq(users.id, documents.ownerId))
      .where(
        and(isNull(documents.archivedAt), scope.grantId ? eq(documents.grantId, scope.grantId) : isNull(documents.grantId)),
      )
      .orderBy(asc(documents.title));
    return rows.map((row) => ({ ...row, state: documentState(row, today) }));
  });
}

export function getDocument(identity: Identity, documentId: string) {
  const id = z.uuid().parse(documentId);
  return asMember(identity, async (tx) => {
    const [document] = await tx.select().from(documents).where(eq(documents.id, id));
    if (!document) throw notFound("That document");
    const versions = await tx
      .select({
        versionNo: documentVersions.versionNo,
        fileId: documentVersions.fileId,
        fileName: files.originalName,
        mimeType: files.mimeType,
        sizeBytes: files.sizeBytes,
        uploadedAt: documentVersions.createdAt,
        uploadedBy: users.name,
      })
      .from(documentVersions)
      .innerJoin(files, eq(files.id, documentVersions.fileId))
      .leftJoin(users, eq(users.id, documentVersions.uploadedBy))
      .where(eq(documentVersions.documentId, id))
      .orderBy(desc(documentVersions.versionNo));
    return { ...document, versions, state: documentState(document, await organizationToday(tx)) };
  });
}
