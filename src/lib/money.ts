export function dollarsToCents(text: string): number {
  const match = /^(\d{1,10})\.(\d{2})$/.exec(text);
  if (!match) throw new Error("Expected dollars with two decimals");
  return Number(match[1]) * 100 + Number(match[2]);
}

export function parseDollars(text: string): number | undefined {
  const cleaned = text.trim().replace(/^\$/, "").replaceAll(",", "");
  const match = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return undefined;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}
