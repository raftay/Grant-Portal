import { z } from "zod";
import { optionalDate, optionalId, optionalText, text } from "./common";

export const documentCategory = z.enum(["w9", "insurance", "policy", "pnl", "executed_contract", "award_letter", "report", "other"]);

export const documentDetails = z.object({
  title: text(200),
  category: documentCategory,
  expiresOn: optionalDate,
  reviewOn: optionalDate,
  ownerId: optionalId,
  notes: optionalText(2000),
});

export const createDocumentInput = documentDetails.extend({ grantId: optionalId, fileId: z.uuid() });
