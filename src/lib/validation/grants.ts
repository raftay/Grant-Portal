import { z } from "zod";
import { email, optionalDate, optionalId, optionalText, text } from "./common";

const blankToNull = (value: unknown) => (value === "" ? null : value);

export const awardCents = z.number().int().min(0).max(1_000_000_000_000);

const awardFields = {
  funderName: text(200),
  awardNumber: optionalText(100),
  awardCents,
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
};

const periodIsOrdered = (value: { startsOn: string; endsOn: string }) => value.endsOn >= value.startsOn;
const periodMessage = { path: ["endsOn"], message: "The end date must be on or after the start date." };

export const awardInput = z.object(awardFields).refine(periodIsOrdered, periodMessage);

export const grantInput = z
  .object({
    ...awardFields,
    name: text(200),
    code: text(30),
    purpose: optionalText(1000),
    awardedOn: optionalDate,
    ownerId: optionalId,
    status: z.enum(["draft", "active", "closed"]),
    termsText: optionalText(20_000),
    sortOrder: z.number().int().min(0).max(1000),
  })
  .refine(periodIsOrdered, periodMessage);

export const contactInput = z.object({
  name: text(100),
  title: optionalText(100),
  agency: optionalText(200),
  email: z.preprocess(blankToNull, email.nullable().default(null)),
  phone: optionalText(50),
  isPrimary: z.boolean(),
});

export const linkInput = z.object({
  label: text(100),
  url: z.string().trim().max(2000).pipe(z.url({ protocol: /^https$/, error: "Enter a web address that starts with https://" })),
});
