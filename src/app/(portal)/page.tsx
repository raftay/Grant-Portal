import Link from "next/link";
import { AttentionList } from "@/components/attention";
import { ToneBadge } from "@/components/badges";
import { LinkButton } from "@/components/link-button";
import { Empty, Panel, PhaseTwoStat, Stat } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { describeActivity } from "@/lib/activity";
import { todayIn } from "@/lib/dates";
import { formatMoment, formatMoney, formatWeekday } from "@/lib/format";
import { pageContext } from "@/server/page";
import { listGrants } from "@/server/services/grants";
import { getOrganization } from "@/server/services/organization";
import { getSummary, listActivity, listAttention } from "@/server/services/overview";

export default async function HomePage() {
  const { identity, canWrite } = await pageContext();
  const [organization, summary, grants, attention, activity] = await Promise.all([
    getOrganization(identity),
    getSummary(identity),
    listGrants(identity),
    listAttention(identity),
    listActivity(identity, 6),
  ]);
  const today = todayIn(organization.timezone);
  const active = grants.filter((grant) => grant.status === "active");
  return (
    <Page
      crumb="Organisation / Home"
      eyebrow={formatWeekday(today)}
      title="Your mission. All in one place."
      lead="Keep your grants, documents and deadlines moving forward."
      actions={
        <>
          {canWrite && <LinkButton href="/organisation/documents?new=1" variant="default">+ Upload document</LinkButton>}
          <LinkButton href="/organisation">Organisation profile →</LinkButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Active grants" value={summary.activeGrants} note="All awarded grants" />
        <Stat label="Total awarded" value={formatMoney(summary.awardedCents)} note="Across your portfolio" />
        <PhaseTwoStat label="Total remaining" />
        <Stat label="Upcoming deadlines" value={summary.deadlinesWithin30Days} note="Within the next 30 days" />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,740fr)_minmax(0,396fr)]">
        <Panel title="Your grants" action={<ToneBadge tone="mint">{active.length} active</ToneBadge>} className="order-2 xl:order-1">
          {active.length === 0 ? (
            <Empty>No active grants yet.</Empty>
          ) : (
            <ul>
              {active.map((grant) => (
                <li key={grant.id} className="border-b last:border-0">
                  <Link href={`/grants/${grant.id}`} className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-3.5 hover:bg-muted">
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold">{grant.name}</span>
                      <span className="text-xs text-muted-foreground">{grant.funderName} · {formatMoney(grant.awardCents)} awarded</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-4">
                      <span className="hidden w-[156px] text-xs text-muted-foreground sm:block">
                        Spending in Phase 2
                        <span className="mt-1.5 block h-[5px] rounded-full border border-dashed border-[#c9d4d7] bg-muted" />
                      </span>
                      <span aria-hidden="true" className="text-lg text-muted-foreground">›</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Needs attention" action={<ToneBadge tone="warn">{attention.length}</ToneBadge>} className="order-1 bg-cream xl:order-2">
          <p className="pb-4 text-muted-foreground">Expiring, due or overdue.</p>
          <AttentionList items={attention} today={today} />
          <LinkButton href="/deadlines">View all deadlines →</LinkButton>
        </Panel>
      </div>
      <Panel title="Recent activity">
        {activity.length === 0 ? (
          <Empty>No activity yet.</Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activity.map((row) => (
              <li key={row.id}>
                <p className="font-medium">{describeActivity(row)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.actorName ? row.actorName : "System"} · {formatMoment(row.occurredAt, organization.timezone)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Page>
  );
}
