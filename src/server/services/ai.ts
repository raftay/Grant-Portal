import { and, asc, count, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Tx } from "@/db/client";
import { aiExtractions, aiProposals, deadlines, documents, documentVersions, files, grants } from "@/db/schema";
import { dollarsToCents } from "@/lib/money";
import { one } from "@/lib/one";
import { createDocumentInput, documentDetails } from "@/lib/validation/documents";
import { deadlineType } from "@/lib/validation/deadlines";
import { awardInput } from "@/lib/validation/grants";
import { optionalId, text } from "@/lib/validation/common";
import { extract, isReadable, model, promptVersion } from "../ai/extract";
import { contractTermsSchema, documentDatesSchema, type ContractTerms, type DocumentDates } from "../ai/schemas";
import { AppError, notFound } from "../errors";
import { readObject } from "../storage/storage";
import { insertDocument } from "./documents";
import { lockGrant, requireContract } from "./grants";
import { asMember, asWriter, type Identity } from "./identity";
import { requireActiveOwner } from "./owners";

const perUserDaily = 20;
const overallDaily = 60;

type Proposal = Pick<typeof aiProposals.$inferInsert, "groupNo" | "targetEntity" | "targetField" | "proposedValue" | "evidence" | "pageNo">;
type Finding = { value: unknown; evidence: string; page: number | null } | null;

function proposal(groupNo: number, targetEntity: string, targetField: string, finding: Finding): Proposal[] {
  if (!finding) return [];
  return [{ groupNo, targetEntity, targetField, proposedValue: finding.value, evidence: finding.evidence, pageNo: finding.page }];
}

function documentProposals(dates: DocumentDates): Proposal[] {
  return [
    ...proposal(0, "documents", "expiresOn", dates.expires_on),
    ...proposal(0, "documents", "reviewOn", dates.review_on),
  ];
}

function contractProposals(terms: ContractTerms): Proposal[] {
  const amount = terms.award_amount && { ...terms.award_amount, value: dollarsToCents(terms.award_amount.value) };
  if (terms.starts_on && terms.ends_on && terms.ends_on.value < terms.starts_on.value) {
    throw new Error("The model returned a grant period that ends before it starts");
  }
  return [
    ...proposal(0, "grants", "funderName", terms.funder_name),
    ...proposal(0, "grants", "awardNumber", terms.award_number),
    ...proposal(0, "grants", "awardCents", amount),
    ...proposal(0, "grants", "startsOn", terms.starts_on),
    ...proposal(0, "grants", "endsOn", terms.ends_on),
    ...terms.deadlines.flatMap((deadline, index) => {
      const group = index + 1;
      const finding = (value: unknown) => ({ value, evidence: deadline.evidence, page: deadline.page });
      return [
        ...proposal(group, "deadlines", "title", finding(deadline.title)),
        ...proposal(group, "deadlines", "type", finding(deadline.type)),
        ...proposal(group, "deadlines", "dueOn", finding(deadline.due_on)),
      ];
    }),
  ];
}

const tasks = {
  document_dates: async (bytes: Uint8Array, mimeType: Parameters<typeof extract>[3]) => {
    const result = await extract(documentDatesSchema, "Find when this document expires and when it must next be reviewed.", bytes, mimeType);
    return { ...result, proposals: documentProposals(result.value) };
  },
  contract_terms: async (bytes: Uint8Array, mimeType: Parameters<typeof extract>[3]) => {
    const result = await extract(contractTermsSchema, "Find the award details and every dated deadline in this grant contract.", bytes, mimeType);
    return { ...result, proposals: contractProposals(result.value) };
  },
};

async function requireAllowance(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(740003)`);
  const since = new Date(Date.now() - 86_400_000);
  const recent = gt(aiExtractions.createdAt, since);
  const mine = one(await tx.select({ n: count() }).from(aiExtractions).where(and(recent, eq(aiExtractions.requestedBy, userId))));
  const all = one(await tx.select({ n: count() }).from(aiExtractions).where(recent));
  if (mine.n >= perUserDaily || all.n >= overallDaily) {
    throw new AppError("throttled", "The daily limit for AI reading has been reached.");
  }
}

type Start = { kind: keyof typeof tasks; pickFile: (tx: Tx) => Promise<{ fileId: string; grantId: string | null }> };

async function run(identity: Identity, start: Start): Promise<string> {
  const job = await asWriter(identity, async (tx) => {
    const { fileId, grantId } = await start.pickFile(tx);
    const [file] = await tx
      .select()
      .from(files)
      .where(and(eq(files.id, fileId), eq(files.status, "ready"), eq(files.sensitivity, "general")));
    if (!file) throw notFound("That file");
    const { mimeType, storageKey } = file;
    if (!isReadable(mimeType)) throw new AppError("invalid", "AI can read PDF, PNG and JPEG files.");
    await requireAllowance(tx, identity.userId);
    const created = await tx
      .insert(aiExtractions)
      .values({ kind: start.kind, fileId, grantId, model, promptVersion })
      .returning({ id: aiExtractions.id });
    return { id: one(created).id, mimeType, storageKey };
  });

  try {
    const result = await tasks[start.kind](await readObject(job.storageKey), job.mimeType);
    await asWriter(identity, async (tx) => {
      if (result.proposals.length > 0) {
        await tx.insert(aiProposals).values(result.proposals.map((row) => ({ ...row, extractionId: job.id })));
      }
      await tx
        .update(aiExtractions)
        .set({ status: "proposed", inputTokens: result.inputTokens, outputTokens: result.outputTokens })
        .where(eq(aiExtractions.id, job.id));
    });
    return job.id;
  } catch (error) {
    await asWriter(identity, (tx) =>
      tx.update(aiExtractions).set({ status: "failed", error: String(error).slice(0, 500) }).where(eq(aiExtractions.id, job.id)),
    );
    throw error;
  }
}

export function readDocumentDates(identity: Identity, fileId: string): Promise<string> {
  const id = z.uuid().parse(fileId);
  return run(identity, { kind: "document_dates", pickFile: async () => ({ fileId: id, grantId: null }) });
}

export function readContract(identity: Identity, grantId: string): Promise<string> {
  const id = z.uuid().parse(grantId);
  return run(identity, {
    kind: "contract_terms",
    pickFile: async (tx) => ({ fileId: (await requireContract(tx, id)).fileId, grantId: id }),
  });
}

export function getExtraction(identity: Identity, extractionId: string) {
  const id = z.uuid().parse(extractionId);
  return asMember(identity, async (tx) => {
    const [extraction] = await tx.select().from(aiExtractions).where(eq(aiExtractions.id, id));
    if (!extraction) throw notFound("That AI reading");
    const proposals = await tx
      .select()
      .from(aiProposals)
      .where(eq(aiProposals.extractionId, id))
      .orderBy(asc(aiProposals.groupNo), asc(aiProposals.targetField));
    return { ...extraction, proposals };
  });
}

async function claim(tx: Tx, extractionId: string, kind?: keyof typeof tasks) {
  const [extraction] = await tx
    .select()
    .from(aiExtractions)
    .where(and(eq(aiExtractions.id, extractionId), kind ? eq(aiExtractions.kind, kind) : undefined, eq(aiExtractions.status, "proposed")))
    .for("update");
  if (!extraction) throw new AppError("conflict", "These suggestions have already been reviewed.");
  return extraction;
}

type Outcome = { final: unknown; entityId: string } | null;

async function settle(tx: Tx, identity: Identity, extractionId: string, decide: (row: typeof aiProposals.$inferSelect) => Outcome) {
  const rows = await tx.select().from(aiProposals).where(eq(aiProposals.extractionId, extractionId));
  for (const row of rows) {
    const outcome = decide(row);
    const rejected = outcome === null || outcome.final === null;
    const status = rejected ? "rejected" : outcome.final === row.proposedValue ? "accepted" : "edited";
    const updated = await tx
      .update(aiProposals)
      .set({
        status,
        finalValue: rejected ? null : outcome.final,
        appliedEntityId: rejected ? null : outcome.entityId,
        reviewedBy: identity.userId,
        reviewedAt: new Date(),
      })
      .where(and(eq(aiProposals.id, row.id), eq(aiProposals.status, "pending")))
      .returning({ id: aiProposals.id });
    one(updated);
  }
  one(await tx.update(aiExtractions).set({ status: "reviewed" }).where(eq(aiExtractions.id, extractionId)).returning({ id: aiExtractions.id }));
  await tx.execute(sql`select app.log_event('approval.ai_reviewed', 'ai_extractions', ${extractionId})`);
}

const reviewed = z.literal(true, { error: "Confirm that you have reviewed the suggested values." });

const documentReviewInput = z.object({ reviewed, document: documentDetails });

export function confirmDocumentDates(
  identity: Identity,
  extractionId: string,
  documentId: string,
  input: z.input<typeof documentReviewInput>,
): Promise<void> {
  const id = z.uuid().parse(extractionId);
  const target = z.uuid().parse(documentId);
  const { document: values } = documentReviewInput.parse(input);
  return asWriter(identity, async (tx) => {
    const extraction = await claim(tx, id, "document_dates");
    if (!extraction.fileId) throw new Error("The AI reading has no file");
    const [document] = await tx
      .select({ id: documents.id, ownerId: documents.ownerId })
      .from(documents)
      .innerJoin(documentVersions, eq(documentVersions.documentId, documents.id))
      .where(and(eq(documents.id, target), eq(documentVersions.fileId, extraction.fileId), sql`${documents.archivedAt} is null`));
    if (!document) throw notFound("That document");
    if (document.ownerId !== values.ownerId) await requireActiveOwner(tx, values.ownerId);
    await tx.update(documents).set(values).where(eq(documents.id, target));
    await settle(tx, identity, id, documentOutcome(values, target));
  });
}

const documentOutcome = (values: { expiresOn: string | null; reviewOn: string | null }, entityId: string) =>
  (row: typeof aiProposals.$inferSelect): Outcome => {
    if (row.targetField !== "expiresOn" && row.targetField !== "reviewOn") throw new Error(`Unexpected field ${row.targetField}`);
    return { final: values[row.targetField], entityId };
  };

const reviewedDocumentInput = z.object({ reviewed, document: createDocumentInput });

export function createReviewedDocument(
  identity: Identity,
  extractionId: string,
  input: z.input<typeof reviewedDocumentInput>,
): Promise<string> {
  const id = z.uuid().parse(extractionId);
  const { document: values } = reviewedDocumentInput.parse(input);
  return asWriter(identity, async (tx) => {
    const extraction = await claim(tx, id, "document_dates");
    if (extraction.fileId !== values.fileId) throw new AppError("invalid", "Those suggestions belong to a different file.");
    const documentId = await insertDocument(tx, identity, values);
    await settle(tx, identity, id, documentOutcome(values, documentId));
    return documentId;
  });
}

export function discardExtraction(identity: Identity, extractionId: string): Promise<void> {
  const id = z.uuid().parse(extractionId);
  return asWriter(identity, async (tx) => {
    await claim(tx, id);
    await settle(tx, identity, id, () => null);
  });
}

const contractReviewInput = z.object({
  reviewed,
  award: awardInput,
  deadlines: z.array(
    z.object({
      groupNo: z.number().int().positive(),
      title: text(200),
      type: deadlineType,
      dueOn: z.iso.date(),
      ownerId: optionalId,
      reminderDays: z.number().int().min(1).max(90),
    }),
  ),
});

export function confirmContract(identity: Identity, extractionId: string, input: z.input<typeof contractReviewInput>): Promise<void> {
  const id = z.uuid().parse(extractionId);
  const values = contractReviewInput.parse(input);
  const groups = new Map(values.deadlines.map((row) => [row.groupNo, row]));
  if (groups.size !== values.deadlines.length) throw new AppError("invalid", "A suggested deadline was confirmed twice.");
  return asWriter(identity, async (tx) => {
    const extraction = await claim(tx, id, "contract_terms");
    const grantId = extraction.grantId;
    if (!grantId) throw new Error("The AI reading has no grant");
    await lockGrant(tx, grantId);
    await tx.update(grants).set(values.award).where(eq(grants.id, grantId));
    const proposed = new Set(
      (await tx.select({ groupNo: aiProposals.groupNo }).from(aiProposals).where(eq(aiProposals.extractionId, id))).map((row) => row.groupNo),
    );
    const created = new Map<number, string>();
    for (const { groupNo, ...deadline } of values.deadlines) {
      if (!proposed.has(groupNo)) throw new AppError("invalid", "That suggested deadline does not exist.");
      await requireActiveOwner(tx, deadline.ownerId);
      const inserted = await tx
        .insert(deadlines)
        .values({ ...deadline, grantId, origin: "ai_contract" })
        .returning({ id: deadlines.id });
      created.set(groupNo, one(inserted).id);
    }
    await settle(tx, identity, id, (row) => {
      if (row.groupNo === 0) {
        const field = row.targetField as keyof typeof values.award;
        if (!(field in values.award)) throw new Error(`Unexpected field ${row.targetField}`);
        return { final: values.award[field], entityId: grantId };
      }
      const deadline = groups.get(row.groupNo);
      const entityId = created.get(row.groupNo);
      if (!deadline || !entityId) return null;
      const field = row.targetField as "title" | "type" | "dueOn";
      if (!(field in deadline)) throw new Error(`Unexpected field ${row.targetField}`);
      return { final: deadline[field], entityId };
    });
  });
}
