import { z } from "zod";
import { email, optionalText, text } from "./common";

const timeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Choose a valid time zone.");

const blankToNull = (value: unknown) => (value === "" ? null : value);

export const organizationInput = z
  .object({
    legalName: text(200),
    ein: z.preprocess(blankToNull, z.string().regex(/^\d{2}-\d{7}$/, "Enter the EIN as 12-3456789.").nullable().default(null)),
    addressLine1: optionalText(200),
    addressLine2: optionalText(200),
    city: optionalText(100),
    state: optionalText(100),
    postalCode: optionalText(20),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
    fiscalYearStartDay: z.coerce.number().int().min(1).max(31),
    signerName: optionalText(100),
    signerTitle: optionalText(100),
    signerEmail: z.preprocess(blankToNull, email.nullable().default(null)),
    timezone: timeZone,
  })
  .refine((value) => value.fiscalYearStartDay <= new Date(Date.UTC(2023, value.fiscalYearStartMonth, 0)).getUTCDate(), {
    path: ["fiscalYearStartDay"],
    message: "That day does not exist in the chosen month.",
  });
