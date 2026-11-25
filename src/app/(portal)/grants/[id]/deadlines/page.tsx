import type { Metadata } from "next";
import { DeadlineBoard, type BoardSearch } from "@/components/deadlines/board";
import { grantTabs, Page } from "@/components/shell/page";
import { todayIn } from "@/lib/dates";
import { ownerChoices } from "@/server/choices";
import { found, pageContext, requireId } from "@/server/page";
import { listDeadlines } from "@/server/services/deadlines";
import { getGrant } from "@/server/services/grants";
import { getOrganization } from "@/server/services/organization";

export const metadata: Metadata = { title: "Grant deadlines" };

export default async function GrantDeadlinesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<BoardSearch> }) {
  const id = requireId((await params).id);
  const { identity, canWrite } = await pageContext();
  const [search, grant, rows, owners, profile] = await Promise.all([searchParams, found(getGrant(identity, id)), listDeadlines(identity, { grantId: id }), ownerChoices(identity), getOrganization(identity)]);
  return (
    <Page crumb="Grants / Deadlines" eyebrow={grant.name} title="Deadlines" lead="Reports, deliverables and contract dates for this grant." tabs={grantTabs(id, "deadlines")}>
      <DeadlineBoard rows={rows} base={`/grants/${id}/deadlines`} search={search} grants={[{ value: id, label: grant.name }]} owners={owners} fixedGrant={id} canWrite={canWrite} today={todayIn(profile.timezone)} timeZone={profile.timezone} />
    </Page>
  );
}
