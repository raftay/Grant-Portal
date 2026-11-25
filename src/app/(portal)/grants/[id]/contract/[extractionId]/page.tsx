import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { confirmContractReading, discardContractReading } from "@/app/actions/files";
import { AiBadge, ToneBadge } from "@/components/badges";
import { ActionForm } from "@/components/forms/action-form";
import { CheckField, SelectField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/quick";
import { LinkButton } from "@/components/link-button";
import { Empty, Notice, Panel, SensitiveNotice } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { centsToInput } from "@/lib/format";
import { deadlineTypeLabels, reminderChoices } from "@/lib/labels";
import { choicesFrom, ownerChoices } from "@/server/choices";
import { found, pageContext, requireId } from "@/server/page";
import { getExtraction } from "@/server/services/ai";
import { getGrant } from "@/server/services/grants";

export const metadata: Metadata = { title: "Contract review" };

const text = (value: string | null) => (value === null ? "" : value);

export default async function ContractReviewPage({ params }: { params: Promise<{ id: string; extractionId: string }> }) {
  const raw = await params;
  const id = requireId(raw.id);
  const extractionId = requireId(raw.extractionId);
  const { identity, canWrite } = await pageContext();
  if (!canWrite) notFound();
  const [grant, extraction, owners] = await Promise.all([found(getGrant(identity, id)), found(getExtraction(identity, extractionId)), ownerChoices(identity)]);
  if (extraction.grantId !== id || extraction.kind !== "contract_terms" || !extraction.fileId) notFound();

  if (extraction.status !== "proposed") {
    return (
      <Page crumb="Grants / Contract review" eyebrow={grant.name} title="Nothing left to review" lead="These suggestions were already reviewed, or the reading failed." actions={<LinkButton href={`/grants/${id}`}>Back to grant</LinkButton>}>
        <LinkButton href={`/grants/${id}/contract`} variant="default">Read the contract again</LinkButton>
      </Page>
    );
  }

  const find = (group: number, name: string) => extraction.proposals.find((row) => row.groupNo === group && row.targetField === name);
  const suggested = (name: string) => {
    const proposal = find(0, name);
    return proposal ? proposal.proposedValue : undefined;
  };
  const award = {
    funderName: suggested("funderName"),
    awardNumber: suggested("awardNumber"),
    awardCents: suggested("awardCents"),
    startsOn: suggested("startsOn"),
    endsOn: suggested("endsOn"),
  };
  const groups = [...new Set(extraction.proposals.map((row) => row.groupNo))].filter((group) => group > 0);
  const names: Record<string, string> = { funderName: "Funder", awardNumber: "Award reference", awardCents: "Award amount", startsOn: "Period starts", endsOn: "Period ends", dueOn: "Deadline" };
  const order = Object.keys(names);
  const quotes = extraction.proposals
    .filter((row) => row.evidence && order.includes(row.targetField))
    .sort((a, b) => a.groupNo - b.groupNo || order.indexOf(a.targetField) - order.indexOf(b.targetField));

  return (
    <Page crumb="Grants / Contract review" eyebrow={`${grant.name} · Contract upload`} title="Review extracted contract details" lead="Check the source document before confirming any suggested values.">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,500fr)_minmax(0,636fr)]">
        <Panel title={grant.contract ? grant.contract.fileName : "Contract"}>
          <iframe src={`/api/files/${extraction.fileId}?mode=view`} title="Contract" className="h-[60dvh] w-full rounded-lg border bg-muted" />
          <h3 className="mt-5 mb-2 font-semibold">Where each value came from</h3>
          <ul className="flex flex-col gap-2">
            {quotes.map((row) => (
              <li key={row.id} className="rounded-lg bg-ai px-3 py-2.5">
                <p className="text-xs font-semibold text-ai-foreground">{names[row.targetField]}{row.pageNo ? ` · page ${row.pageNo}` : ""}</p>
                <p className="mt-0.5">“{row.evidence}”</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <div className="flex flex-col gap-4">
            <Notice tone="ai" title="Nothing is saved until you confirm">
              Purple fields are AI suggestions. Review each value against the contract or enter the details manually.
            </Notice>
            <ActionForm
              action={confirmContractReading}
              submitLabel="Confirm & save"
              pendingLabel="Saving"
              secondary={
                <ActionButton
                  action={discardContractReading}
                  values={{ grantId: id, extractionId }}
                  label="Discard"
                  pendingLabel="Discarding"
                  confirm={{ title: "Discard these suggestions?", body: "Nothing from this reading will be saved. The contract file stays." }}
                />
              }
            >
              <input type="hidden" name="grantId" value={id} />
              <input type="hidden" name="extractionId" value={extractionId} />
              <TextField name="funderName" label="Funder" ai={award.funderName !== undefined} defaultValue={award.funderName === undefined ? grant.funderName : String(award.funderName)} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="award" label="Award amount (US$)" inputMode="decimal" ai={award.awardCents !== undefined} defaultValue={centsToInput(award.awardCents === undefined ? grant.awardCents : Number(award.awardCents))} required />
                <TextField name="awardNumber" label="Award reference" ai={award.awardNumber !== undefined} defaultValue={award.awardNumber === undefined ? text(grant.awardNumber) : String(award.awardNumber)} />
                <TextField name="startsOn" label="Period starts" type="date" ai={award.startsOn !== undefined} defaultValue={award.startsOn === undefined ? grant.startsOn : String(award.startsOn)} required />
                <TextField name="endsOn" label="Period ends" type="date" ai={award.endsOn !== undefined} defaultValue={award.endsOn === undefined ? grant.endsOn : String(award.endsOn)} required />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[15px] font-semibold">Proposed deadlines</h3>
                {groups.length > 0 && <AiBadge>AI suggested · {groups.length}</AiBadge>}
              </div>
              {groups.length === 0 && <Empty>No dated deadlines were found.</Empty>}
              {groups.map((group) => {
                const title = find(group, "title");
                const type = find(group, "type");
                const dueOn = find(group, "dueOn");
                if (!title || !type || !dueOn) throw new Error("A suggested deadline is incomplete");
                return (
                  <fieldset key={group} className="rounded-lg border border-ai-border bg-ai/30 p-3.5">
                    <legend className="sr-only">{String(title.proposedValue)}</legend>
                    <input type="hidden" name="group" value={group} />
                    <div className="mb-3 flex justify-between gap-3">
                      <CheckField name={`include-${group}`} label="Add this deadline" defaultChecked />
                      <ToneBadge tone="ai">{group}</ToneBadge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                      <TextField name={`title-${group}`} label="Title" defaultValue={String(title.proposedValue)} />
                      <SelectField name={`type-${group}`} label="Type" choices={choicesFrom(deadlineTypeLabels)} defaultValue={String(type.proposedValue)} />
                      <TextField name={`dueOn-${group}`} label="Due date" type="date" defaultValue={String(dueOn.proposedValue)} />
                    </div>
                  </fieldset>
                );
              })}
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField name="ownerId" label="Assigned owner" choices={owners} placeholder="No owner" defaultValue={text(grant.ownerId)} />
                <SelectField name="reminderDays" label="Email reminder" choices={reminderChoices.map((days) => ({ value: String(days), label: days === 1 ? "1 day before" : `${days} days before` }))} defaultValue="7" />
              </div>
              <CheckField name="reviewed" label="I reviewed all suggested values and deadlines." />
            </ActionForm>
          </div>
        </Panel>
      </div>
      <SensitiveNotice />
    </Page>
  );
}
