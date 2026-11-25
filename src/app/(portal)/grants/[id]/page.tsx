import type { Metadata } from "next";
import { ToneBadge } from "@/components/badges";
import { FileLinks, LinkButton } from "@/components/link-button";
import { Empty, Panel, PhaseTwoStat, Stat } from "@/components/panels";
import { grantTabs, Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { formatDay, formatLongDay, formatMoment, formatMoney, formatPeriod, formatShortDay } from "@/lib/format";
import { deadlineStatusLabels, grantStatusLabels, roleLabels } from "@/lib/labels";
import { found, pageContext, requireId } from "@/server/page";
import { getGrant } from "@/server/services/grants";
import { getOrganization } from "@/server/services/organization";

export const metadata: Metadata = { title: "Grant" };

export default async function GrantPage({ params }: { params: Promise<{ id: string }> }) {
  const id = requireId((await params).id);
  const { identity, canWrite } = await pageContext();
  const [grant, profile] = await Promise.all([found(getGrant(identity, id)), getOrganization(identity)]);
  const next = grant.upcoming[0];
  const contact = grant.contacts[0];
  const facts: [string, string][] = [
    ["Funder", grant.funderName],
    ["Grant owner", grant.ownerName ? grant.ownerName : "No owner"],
    ["Grant period", `${formatLongDay(grant.startsOn)} – ${formatLongDay(grant.endsOn)}`],
    ["Award reference", grant.awardNumber ? grant.awardNumber : "Not set"],
    ["Purpose", grant.purpose ? grant.purpose : "Not set"],
  ];
  return (
    <Page
      crumb={`Grants / ${grant.name}`}
      eyebrow={`Grant workspace · ${grant.code}`}
      title={grant.name}
      lead={`${grant.funderName} · ${formatPeriod(grant.startsOn, grant.endsOn)}`}
      tabs={grantTabs(id, "overview")}
      actions={
        canWrite && (
          <>
            <LinkButton href={`/grants/${id}/edit`}>Edit grant</LinkButton>
            <LinkButton href={`/grants/${id}/contract`} variant="default">{grant.contract ? "Contract" : "Upload contract"}</LinkButton>
          </>
        )
      }
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Award amount" value={formatMoney(grant.awardCents)} note={grant.awardedOn ? `Approved ${formatLongDay(grant.awardedOn)}` : "Award total"} />
        <PhaseTwoStat label="Spent to date" />
        <PhaseTwoStat label="Remaining" />
        {next ? <Stat label="Next deadline" value={formatShortDay(next.dueOn)} note={next.title} /> : <Stat label="Next deadline" value="None" note="No open deadlines" />}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,710fr)_minmax(0,426fr)]">
        <Panel title="Grant information" action={<ToneBadge tone={grant.status === "active" ? "mint" : "plain"}>{grantStatusLabels[grant.status]}</ToneBadge>}>
          <dl>
            {facts.map(([label, value]) => (
              <div key={label} className="grid gap-1 border-b py-3 sm:grid-cols-[177px_1fr]">
                <dt className="font-medium">{label}</dt>
                <dd className="text-muted-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <h3 className="mt-4 font-semibold">Executed contract</h3>
          {grant.contract ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium break-words text-primary">{grant.contract.fileName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Uploaded · {grant.contract.uploadedBy ? grant.contract.uploadedBy : "System"} · {formatMoment(grant.contract.uploadedAt, profile.timezone)}
                </p>
              </div>
              <FileLinks fileId={grant.contract.fileId} name="contract" />
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">No contract uploaded yet.</p>
          )}
        </Panel>
        <Panel title="Agency contact">
          {contact ? (
            <div className="flex flex-col gap-2">
              <p className="text-[14px] font-semibold">{contact.name}</p>
              <p className="text-xs text-muted-foreground">{[contact.title, contact.agency].filter(Boolean).join(" · ")}</p>
              {contact.email && <a href={`mailto:${contact.email}`} className="font-medium break-words text-primary hover:underline">{contact.email}</a>}
              {contact.phone && <a href={`tel:${contact.phone}`} className="text-muted-foreground hover:underline">{contact.phone}</a>}
            </div>
          ) : (
            <p className="text-muted-foreground">No contact yet.</p>
          )}
          <hr className="my-4" />
          <h3 className="mb-3 text-[14px] font-semibold">Funder portal</h3>
          {grant.links.length === 0 && <p className="text-muted-foreground">No links yet.</p>}
          <div className="flex flex-wrap gap-2">
            {grant.links.map((link) => (
              <Button key={link.id} asChild variant="outline">
                <a href={link.url} target="_blank" rel="noreferrer">{link.label} ↗</a>
              </Button>
            ))}
          </div>
          {grant.links.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Use your funder-issued credentials.</p>}
          <hr className="my-4" />
          <h3 className="text-[14px] font-semibold">Grant owner</h3>
          <p className="mt-1 text-muted-foreground">{grant.ownerName && grant.ownerRole ? `${grant.ownerName} · ${roleLabels[grant.ownerRole]}` : "No owner"}</p>
        </Panel>
      </div>
      <Panel title="Coming up next" action={<LinkButton href={`/grants/${id}/deadlines`}>View deadlines →</LinkButton>}>
        {grant.upcoming.length === 0 ? (
          <Empty>No open deadlines.</Empty>
        ) : (
          <table className="stack-table">
            <thead>
              <tr>
                <th scope="col">Deadline</th>
                <th scope="col">Owner</th>
                <th scope="col">Due date</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {grant.upcoming.map((row) => (
                <tr key={row.id}>
                  <td data-label="Deadline">{row.title}</td>
                  <td data-label="Owner">{row.ownerName ? row.ownerName : "No owner"}</td>
                  <td data-label="Due date">{formatDay(row.dueOn)}</td>
                  <td data-label="Status">{deadlineStatusLabels[row.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </Page>
  );
}
