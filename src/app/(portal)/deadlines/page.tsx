import type { Metadata } from "next";
import { DeadlineBoard, type BoardSearch } from "@/components/deadlines/board";
import { Page } from "@/components/shell/page";
import { todayIn } from "@/lib/dates";
import { ownerChoices } from "@/server/choices";
import { pageContext } from "@/server/page";
import { listDeadlines } from "@/server/services/deadlines";
import { listGrants } from "@/server/services/grants";
import { getOrganization } from "@/server/services/organization";

export const metadata: Metadata = { title: "Deadlines" };

export default async function DeadlinesPage({ searchParams }: { searchParams: Promise<BoardSearch> }) {
  const { identity, canWrite } = await pageContext();
  const [search, rows, grants, owners, profile] = await Promise.all([searchParams, listDeadlines(identity, {}), listGrants(identity), ownerChoices(identity), getOrganization(identity)]);
  return (
    <Page crumb="Deadlines" eyebrow="Workspace" title="Deadlines" lead="A clear owner and a timely reminder for every commitment.">
      <DeadlineBoard rows={rows} base="/deadlines" search={search} grants={grants.map((grant) => ({ value: grant.id, label: grant.name }))} owners={owners} canWrite={canWrite} today={todayIn(profile.timezone)} timeZone={profile.timezone} />
    </Page>
  );
}
