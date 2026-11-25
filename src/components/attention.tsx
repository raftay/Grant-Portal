import Link from "next/link";
import { ToneBadge } from "@/components/badges";
import { daysBetween } from "@/lib/dates";
import { formatShortDay } from "@/lib/format";
import type { listAttention } from "@/server/services/overview";

export type AttentionItem = Awaited<ReturnType<typeof listAttention>>[number];

function describe(item: AttentionItem, today: string): { text: string; overdue: boolean } {
  const day = formatShortDay(item.dueOn);
  const days = daysBetween(today, item.dueOn);
  if (days < 0) return { text: `Overdue · ${day}`, overdue: true };
  if (item.state === "review_due") return { text: `Review by ${day}`, overdue: false };
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return { text: `${item.kind === "document" ? "Expires" : "Due"} ${day} · ${when}`, overdue: false };
}

export function AttentionList({ items, today }: { items: AttentionItem[]; today: string }) {
  if (items.length === 0) return <p className="border-t pt-4 text-muted-foreground">Nothing needs attention right now.</p>;
  return (
    <ul>
      {items.map((item) => {
        const { text, overdue } = describe(item, today);
        const href = item.kind === "document" ? `/documents/${item.id}` : `/deadlines?edit=${item.id}&window=all`;
        return (
          <li key={item.id} className="flex flex-col items-start gap-2 border-t py-4">
            <Link href={href} className="font-semibold hover:underline">{item.title}</Link>
            <ToneBadge tone={overdue ? "danger" : "warn"}>{text}</ToneBadge>
            <p className="text-xs text-muted-foreground">{item.ownerName ? `Owner: ${item.ownerName}` : "No owner"}</p>
          </li>
        );
      })}
    </ul>
  );
}
