"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";
import { actor, attempt, field, submit, ticked, type FormState, type Outcome } from "@/server/action";
import { AppError } from "@/server/errors";
import { parseDollars } from "@/lib/money";
import type { createUploadInput } from "@/lib/validation/files";
import { confirmContract, createReviewedDocument, discardExtraction, getExtraction, readContract, readDocumentDates } from "@/server/services/ai";
import { createDocument, replaceDocumentFile } from "@/server/services/documents";
import { createUpload, finalizeUpload } from "@/server/services/files";

export async function startUpload(input: z.input<typeof createUploadInput>): Promise<Outcome<{ fileId: string; url: string; headers: Record<string, string> }>> {
  return attempt(async () => createUpload(await actor(), input));
}

export async function finishUpload(fileId: string): Promise<Outcome<null>> {
  return attempt(async () => {
    await finalizeUpload(await actor(), fileId);
    return null;
  });
}

export type Suggestion = { value: string; evidence: string | null; page: number | null };
export type DateSuggestions = { extractionId: string; expiresOn: Suggestion | null; reviewOn: Suggestion | null };

export async function suggestDates(fileId: string): Promise<DateSuggestions> {
  const identity = await actor();
  const extractionId = await readDocumentDates(identity, fileId);
  const { proposals } = await getExtraction(identity, extractionId);
  const pick = (name: string): Suggestion | null => {
    const proposal = proposals.find((row) => row.targetField === name);
    return proposal ? { value: String(proposal.proposedValue), evidence: proposal.evidence, page: proposal.pageNo } : null;
  };
  return { extractionId, expiresOn: pick("expiresOn"), reviewOn: pick("reviewOn") };
}

export async function addDocument(_state: FormState, form: FormData): Promise<FormState> {
  return submit(async () => {
    const identity = await actor();
    const document = {
      title: field(form, "title"),
      category: field(form, "category") as "other",
      expiresOn: field(form, "expiresOn"),
      reviewOn: field(form, "reviewOn"),
      ownerId: field(form, "ownerId"),
      notes: "",
      grantId: field(form, "grantId"),
      fileId: field(form, "fileId"),
    };
    const extractionId = field(form, "extractionId");
    if (extractionId) {
      if (!ticked(form, "reviewed")) throw new AppError("invalid", "Confirm that you have reviewed the suggested values.");
      await createReviewedDocument(identity, extractionId, { reviewed: true, document });
    } else {
      await createDocument(identity, document);
    }
    return "Document saved.";
  });
}

export async function replaceFile(documentId: string, fileId: string): Promise<Outcome<number>> {
  return attempt(async () => replaceDocumentFile(await actor(), documentId, fileId));
}

export async function addContract(grantId: string, fileId: string): Promise<Outcome<string>> {
  return attempt(async () =>
    createDocument(await actor(), { title: "Executed contract", category: "executed_contract", expiresOn: "", reviewOn: "", ownerId: "", notes: "", grantId, fileId }),
  );
}

export async function startContractReading(_state: FormState, form: FormData): Promise<FormState> {
  const grantId = field(form, "grantId");
  let extractionId = "";
  const result = await submit(async () => {
    extractionId = await readContract(await actor(), grantId);
    return "";
  });
  if (result.status === "done") redirect(`/grants/${grantId}/contract/${extractionId}`);
  return result;
}

export async function confirmContractReading(_state: FormState, form: FormData): Promise<FormState> {
  const grantId = field(form, "grantId");
  const result = await submit(async () => {
    const awardCents = parseDollars(field(form, "award"));
    if (awardCents === undefined) throw new AppError("invalid", "Enter the amount in dollars, such as 150,000.00.");
    const groups = form.getAll("group").map((value) => Number(value));
    if (!ticked(form, "reviewed")) throw new AppError("invalid", "Confirm that you have reviewed the suggested values.");
    await confirmContract(await actor(), field(form, "extractionId"), {
      reviewed: true,
      award: {
        funderName: field(form, "funderName"),
        awardNumber: field(form, "awardNumber"),
        awardCents,
        startsOn: field(form, "startsOn"),
        endsOn: field(form, "endsOn"),
      },
      deadlines: groups
        .filter((group) => ticked(form, `include-${group}`))
        .map((group) => ({
          groupNo: group,
          title: field(form, `title-${group}`),
          type: field(form, `type-${group}`) as "report",
          dueOn: field(form, `dueOn-${group}`),
          ownerId: field(form, "ownerId"),
          reminderDays: Number(field(form, "reminderDays")),
        })),
    });
    return "";
  });
  if (result.status === "done") redirect(`/grants/${grantId}`);
  return result;
}

export async function discardContractReading(_state: FormState, form: FormData): Promise<FormState> {
  const grantId = field(form, "grantId");
  const result = await submit(async () => {
    await discardExtraction(await actor(), field(form, "extractionId"));
    return "";
  });
  if (result.status === "done") redirect(`/grants/${grantId}`);
  return result;
}
