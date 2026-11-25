import type { Metadata } from "next";
import Link from "next/link";
import { ToneBadge } from "@/components/badges";
import { LinkButton } from "@/components/link-button";
import { Empty } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { formatDay, formatMoney, formatPeriod } from "@/lib/format";
import { grantStatusLabels } from "@/lib/labels";
import { pageContext } from "@/server/page";
import { listGrants } from "@/server/services/grants";

export const metadata: Metadata = { title: "Grants" };

export default async function GrantsPage() {
  const { identity, canWrite } = await pageContext();
  const grants = await listGrants(identity);
  return (
    <Page crumb="Grants" eyebrow="Workspace" title="Your grants" lead="Every award in one place." actions={canWrite && <LinkButton href="/grants/new" variant="default">+ New grant</LinkButton>}>
      {grants.length === 0 ? (
        <Empty>No grants yet.</Empty>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {grants.map((grant) => (
            <li key={grant.id}>
              <Link href={`/grants/${grant.id}`} className="flex h-full flex-col gap-1 rounded-[10px] border bg-card p-5 hover:border-primary">
                <span className="flex items-start justify-between gap-3">
                  <span className="text-[15px] font-semibold">{grant.name}</span>
                  <ToneBadge tone={grant.status === "active" ? "mint" : "plain"}>{grantStatusLabels[grant.status]}</ToneBadge>
                </span>
                <span className="text-muted-foreground">{grant.funderName} · {formatPeriod(grant.startsOn, grant.endsOn)}</span>
                <span className="mt-2 font-semibold text-primary">{formatMoney(grant.awardCents)} awarded</span>
                <span className="text-xs text-muted-foreground">
                  {grant.nextDeadlineOn ? `Next deadline ${formatDay(grant.nextDeadlineOn)}` : "No open deadlines"} · {grant.ownerName ? grant.ownerName : "No owner"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
