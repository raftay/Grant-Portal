import { z } from "zod";
import { optionalId, optionalText, text } from "./common";

export const deadlineType = z.enum(["report", "deliverable", "contract_expiry"]);
export const deadlineStatus = z.enum(["open", "in_progress", "completed", "waived"]);

export const deadlineInput = z.object({
  grantId: z.uuid(),
  type: deadlineType,
  title: text(200),
  description: optionalText(2000),
  dueOn: z.iso.date(),
  ownerId: optionalId,
  status: deadlineStatus,
  reminderDays: z.number().int().min(1).max(90),
});

export const deadlineFilter = z.object({
  grantId: z.uuid().optional(),
  ownerId: z.uuid().optional(),
  type: deadlineType.optional(),
  status: deadlineStatus.optional(),
});
