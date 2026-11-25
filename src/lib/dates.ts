export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type DocumentState = "expired" | "review_overdue" | "expiring" | "review_due" | "current";

export function documentState(document: { expiresOn: string | null; reviewOn: string | null }, today: string): DocumentState {
  const expiry = document.expiresOn ? daysBetween(today, document.expiresOn) : undefined;
  const review = document.reviewOn ? daysBetween(today, document.reviewOn) : undefined;
  if (expiry !== undefined && expiry < 0) return "expired";
  if (review !== undefined && review < 0) return "review_overdue";
  if (expiry !== undefined && expiry <= 30) return "expiring";
  if (review !== undefined && review <= 30) return "review_due";
  return "current";
}
