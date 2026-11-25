import { z } from "zod";

const evidence = z.string().describe("A short exact quote from the document that supports the value");
const page = z.number().int().nullable().describe("The page the quote is on, or null for an image");

const found = <T extends z.ZodType>(value: T) => z.object({ value, evidence, page }).nullable();

const date = z.iso.date().describe("Calendar date as YYYY-MM-DD");

export const documentDatesSchema = z.object({
  expires_on: found(date).describe("When the document stops being valid, or null if it does not say"),
  review_on: found(date).describe("When the document must next be reviewed, or null if it does not say"),
});

export const contractTermsSchema = z.object({
  funder_name: found(z.string().min(1).max(200)),
  award_number: found(z.string().min(1).max(100)),
  award_amount: found(z.string().regex(/^\d{1,10}\.\d{2}$/)).describe("Total award in US dollars, digits with two decimals, such as 150000.00"),
  starts_on: found(date).describe("First day of the grant period"),
  ends_on: found(date).describe("Last day of the grant period"),
  deadlines: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        type: z.enum(["report", "deliverable", "contract_expiry"]),
        due_on: date,
        evidence,
        page,
      }),
    )
    .max(30)
    .describe("Every report, deliverable or expiry with a stated calendar date"),
});

export type DocumentDates = z.infer<typeof documentDatesSchema>;
export type ContractTerms = z.infer<typeof contractTermsSchema>;
