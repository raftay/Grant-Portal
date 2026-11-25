export function dollarsToCents(text: string): number {
  const match = /^(\d{1,10})\.(\d{2})$/.exec(text);
  if (!match) throw new Error("Expected dollars with two decimals");
  return Number(match[1]) * 100 + Number(match[2]);
}
