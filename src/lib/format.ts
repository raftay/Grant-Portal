const utc = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options });

const full = utc({ day: "numeric", month: "short", year: "numeric" });
const short = utc({ day: "numeric", month: "short" });
const long = utc({ day: "numeric", month: "long", year: "numeric" });
const longDay = utc({ day: "numeric", month: "long" });
const weekday = utc({ weekday: "long", day: "numeric", month: "long", year: "numeric" });

const parse = (day: string) => new Date(`${day}T00:00:00Z`);

export const formatDay = (day: string) => full.format(parse(day));
export const formatShortDay = (day: string) => short.format(parse(day));
export const formatLongDay = (day: string) => long.format(parse(day));
export const formatWeekday = (day: string) => weekday.format(parse(day));

export function formatPeriod(start: string, end: string): string {
  return start.slice(0, 4) === end.slice(0, 4) ? `${formatShortDay(start)} – ${formatDay(end)}` : `${formatDay(start)} – ${formatDay(end)}`;
}

export function formatFiscalYear(month: number, day: number): string {
  const start = new Date(Date.UTC(2023, month - 1, day));
  const end = new Date(start.getTime() + 364 * 86_400_000);
  return `${longDay.format(start)} – ${longDay.format(end)}`;
}

export function formatMoment(moment: Date, timeZone: string): string {
  const date = new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric" }).format(moment);
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(moment);
  return `${date} · ${time}`;
}

export function formatMoney(cents: number): string {
  const digits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
}

export const centsToInput = (cents: number) => `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

export function formatBytes(bytes: number): string {
  return bytes < 1_048_576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1_048_576).toFixed(1)} MB`;
}
