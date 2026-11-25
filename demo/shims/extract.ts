import type { z } from "zod";
import { contractTermsSchema } from "@/server/ai/schemas";

export const model = "simulated-demo";
export const promptVersion = "demo";
export const readableTypes = ["application/pdf", "image/png", "image/jpeg"] as const;
export type ReadableType = (typeof readableTypes)[number];
export const isReadable = (mimeType: string): mimeType is ReadableType => (readableTypes as readonly string[]).includes(mimeType);

type Line = { text: string; page: number };

function readLines(bytes: Uint8Array): Line[] {
  const source = new TextDecoder("latin1").decode(bytes);
  const lines = [...source.matchAll(/stream\n([\s\S]*?)\nendstream/g)].flatMap((stream, index) =>
    [...stream[1]!.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map((match) => ({ text: match[1]!.replace(/\\(.)/g, "$1"), page: index + 1 })),
  );
  if (lines.length === 0) throw new Error("The demo reader understands only the sample PDFs");
  return lines;
}

const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function dateIn(text: string): string | undefined {
  const match = /(\d{1,2}) ([A-Za-z]+) (\d{4})/.exec(text);
  const month = match ? months.indexOf(match[2]!.toLowerCase()) + 1 : 0;
  return match && month > 0 ? `${match[3]}-${String(month).padStart(2, "0")}-${match[1]!.padStart(2, "0")}` : undefined;
}

function finding(lines: Line[], pattern: RegExp, value: (line: Line) => string | undefined) {
  const line = lines.find((candidate) => pattern.test(candidate.text));
  const found = line && value(line);
  return line && found ? { value: found, evidence: line.text, page: line.page } : null;
}

function readContract(lines: Line[]) {
  const title = lines.findIndex((line) => line.text === "1. Award");
  const funder = lines[title - 2];
  return {
    funder_name: funder ? { value: funder.text, evidence: funder.text, page: funder.page } : null,
    award_number: finding(lines, /Award number/, (line) => /Award number ([\w-]+)/.exec(line.text)?.[1]),
    award_amount: finding(lines, /\$[\d,]+\.\d{2}/, (line) => /\$([\d,]+\.\d{2})/.exec(line.text)?.[1]?.replaceAll(",", "")),
    starts_on: finding(lines, /period begins/, (line) => dateIn(line.text)),
    ends_on: finding(lines, /and ends on/, (line) => dateIn(line.text)),
    deadlines: lines.flatMap((line) => {
      const match = /^(.+) is due on /.exec(line.text);
      const due = dateIn(line.text);
      if (!match?.[1] || !due) return [];
      const title = match[1];
      const type = /expiry/i.test(title) ? "contract_expiry" : /report/i.test(title) ? "report" : "deliverable";
      return [{ title, type, due_on: due, evidence: line.text, page: line.page }];
    }),
  };
}

const readDates = (lines: Line[]) => ({
  expires_on: finding(lines, /expires on/i, (line) => dateIn(line.text)),
  review_on: finding(lines, /review date/i, (line) => dateIn(line.text)),
});

export type Extraction<T> = { value: T; inputTokens: number; outputTokens: number };

export async function extract<S extends z.ZodType>(schema: S, task: string, bytes: Uint8Array, mimeType: ReadableType): Promise<Extraction<z.infer<S>>> {
  await new Promise((resolve) => setTimeout(resolve, 2600));
  if (mimeType !== "application/pdf") throw new Error(`The demo reader cannot do this: ${task}`);
  const lines = readLines(bytes);
  const value = (schema as unknown) === contractTermsSchema ? readContract(lines) : readDates(lines);
  return { value: schema.parse(value), inputTokens: 0, outputTokens: 0 };
}
