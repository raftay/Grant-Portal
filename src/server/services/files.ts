import { randomUUID, createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { files } from "@/db/schema";
import { createUploadInput, fileTypes, type FileType } from "@/lib/validation/files";
import { AppError, notFound } from "../errors";
import { objectSize, readObject, removeObject, signDownload, signUpload, writeObject } from "../storage/storage";
import { asMember, asWriter, type Identity } from "./identity";

const signatures: Record<FileType, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46, 0x2d],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [0x50, 0x4b, 0x03, 0x04],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [0x50, 0x4b, 0x03, 0x04],
};

const incoming = (storageKey: string) => `incoming/${storageKey}`;

const inlineTypes = new Set<string>(["application/pdf", "image/png", "image/jpeg"]);

export async function createUpload(identity: Identity, input: z.input<typeof createUploadInput>) {
  const { name, mimeType, sizeBytes, sensitivity } = createUploadInput.parse(input);
  const storageKey = `${sensitivity}/${randomUUID()}.${fileTypes[mimeType]}`;
  const id = await asWriter(identity, async (tx) => {
    const [row] = await tx
      .insert(files)
      .values({ storageKey, originalName: name, mimeType, sizeBytes, sensitivity })
      .returning({ id: files.id });
    return row!.id;
  });
  return { fileId: id, url: await signUpload(incoming(storageKey), mimeType, sizeBytes), headers: { "content-type": mimeType } };
}

export async function finalizeUpload(identity: Identity, fileId: string): Promise<void> {
  const id = z.uuid().parse(fileId);
  const file = await asWriter(identity, async (tx) => {
    const [row] = await tx
      .select()
      .from(files)
      .where(and(eq(files.id, id), eq(files.status, "pending"), eq(files.uploadedBy, identity.userId)));
    return row;
  });
  if (!file) throw notFound("That upload");

  const storedBytes = await objectSize(incoming(file.storageKey));

  let problem: string | undefined;
  let sha256: string | undefined;
  if (storedBytes !== file.sizeBytes) problem = "The uploaded file is not the expected size.";
  else {
    const bytes = await readObject(incoming(file.storageKey));
    const expected = signatures[file.mimeType as FileType];
    if (bytes.byteLength !== file.sizeBytes) problem = "The uploaded file is not the expected size.";
    else if (!expected?.every((byte, index) => bytes[index] === byte)) problem = "The file contents do not match its type.";
    else {
      sha256 = createHash("sha256").update(bytes).digest("hex");
      await writeObject(file.storageKey, bytes, file.mimeType);
    }
  }

  await asWriter(identity, async (tx) => {
    const updated = await tx
      .update(files)
      .set(problem ? { status: "failed" } : { status: "ready", readyAt: new Date(), sha256 })
      .where(and(eq(files.id, id), eq(files.status, "pending")))
      .returning({ id: files.id });
    if (updated.length === 0) throw notFound("That upload");
    if (!problem) await tx.execute(sql`select app.log_event('file.uploaded', 'files', ${id}, null, null, ${file.sensitivity})`);
  });

  await removeObject(incoming(file.storageKey));
  if (problem) throw new AppError("invalid", problem);
}

function contentDisposition(name: string, inline: boolean): string {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function openFile(identity: Identity, fileId: string, mode: "view" | "download"): Promise<string> {
  const id = z.uuid().parse(fileId);
  const file = await asMember(identity, async (tx) => {
    const [row] = await tx.select().from(files).where(and(eq(files.id, id), eq(files.status, "ready")));
    if (!row) throw notFound("That file");
    const event = mode === "view" ? "file.viewed" : "file.downloaded";
    await tx.execute(sql`select app.log_event(${event}, 'files', ${id}, null, null, ${row.sensitivity})`);
    return row;
  });
  const inline = mode === "view" && inlineTypes.has(file.mimeType);
  return signDownload(file.storageKey, contentDisposition(file.originalName, inline), file.mimeType);
}
