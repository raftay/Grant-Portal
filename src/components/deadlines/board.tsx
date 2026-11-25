import Link from "next/link";
import { saveDeadline } from "@/app/actions/records";
import { ToneBadge } from "@/components/badges";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField, type Choice } from "@/components/forms/fields";
import { FilterSelect } from "@/components/forms/quick";
import { LinkButton } from "@/components/link-button";
import { Empty, Notice, Panel } from "@/components/panels";
import { addDays } from "@/lib/dates";
import { formatDay, formatMoment } from "@/lib/format";
import { deadlineStatusLabels, deadlineTypeLabels, reminderChoices } from "@/lib/labels";
import { choicesFrom } from "@/server/choices";
import type { listDeadlines } from "@/server/services/deadlines";

type Row = Awaited<ReturnType<typeof listDeadlines>>[number];
export type BoardSearch = { grant?: string; owner?: string; window?: string; edit?: string; new?: string };

type Props = {
  rows: Row[];
  base: string;
  search: BoardSearch;
  grants: Choice[];
  owners: Choice[];
  fixedGrant?: string;
  canWrite: boolean;
  today: string;
  timeZone: string;
};

function Table({ rows, hrefFor }: { rows: Row[]; hrefFor: (id: string) => string }) {
  return (
    <table className="stack-table">
      <thead>
        <tr>
          <th scope="col">Deadline / grant</th>
          <th scope="col">Due date</th>
          <th scope="col">Owner</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td data-label="Deadline">
              <Link href={hrefFor(row.id)} scroll={false} className="hover:underline">
                <span className="block">{row.title}</span>
                <span className="text-xs font-normal text-muted-foreground">{row.grantName} · {deadlineTypeLabels[row.type]}</span>
              </Link>
            </td>
            <td data-label="Due date">{formatDay(row.dueOn)}</td>
            <td data-label="Owner">{row.ownerName ? row.ownerName : "No owner"}</td>
            <td data-label="Status">
              <span className="flex flex-wrap items-center justify-end gap-2 md:justify-start">
                {deadlineStatusLabels[row.status]}
                {row.state === "overdue" && <ToneBadge tone="danger">Overdue</ToneBadge>}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const reminders = (current?: number) => {
  const days = current && !reminderChoices.includes(current) ? [...reminderChoices, current].sort((a, b) => a - b) : reminderChoices;
  return days.map((value) => ({ value: String(value), label: value === 1 ? "1 day before" : `${value} days before` }));
};

export function DeadlineBoard({ rows, base, search, grants, owners, fixedGrant, canWrite, today, timeZone }: Props) {
  const windowed = search.window !== "all";
  const keep = new URLSearchParams();
  if (search.grant && !fixedGrant) keep.set("grant", search.grant);
  if (search.owner) keep.set("owner", search.owner);
  if (search.window) keep.set("window", search.window);
  const withKeep = (extra: Record<string, string>) => {
    const params = new URLSearchParams(keep);
    for (const [name, value] of Object.entries(extra)) params.set(name, value);
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };
  const editing = rows.find((row) => row.id === search.edit);
  const adding = search.new === "1";
  const shown = rows.filter((row) => (!search.grant || fixedGrant || row.grantId === search.grant) && (!search.owner || row.ownerId === search.owner));
  const open = shown.filter((row) => row.state !== "done");
  const horizon = addDays(today, 30);
  const upcoming = windowed ? open.filter((row) => row.dueOn <= horizon) : open;
  const later = windowed ? open.filter((row) => row.dueOn > horizon) : [];
  const done = shown.filter((row) => row.state === "done");
  const panel = canWrite && (editing || adding);
  const hrefFor = (id: string) => withKeep({ edit: id });
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <form action={base} className="flex w-full flex-wrap gap-3 sm:w-auto">
          {!fixedGrant && <FilterSelect name="grant" label="Grant" current={search.grant ? search.grant : ""} choices={[{ value: "", label: "All grants" }, ...grants]} />}
          <FilterSelect name="window" label="When" current={windowed ? "30" : "all"} choices={[{ value: "30", label: "Next 30 days" }, { value: "all", label: "All dates" }]} />
          <FilterSelect name="owner" label="Owner" current={search.owner ? search.owner : ""} choices={[{ value: "", label: "All owners" }, ...owners]} />
        </form>
        <p className="text-muted-foreground">{upcoming.length === 1 ? "1 upcoming deadline" : `${upcoming.length} upcoming deadlines`}</p>
        {canWrite && <div className="ml-auto"><LinkButton href={withKeep({ new: "1" })} variant="default">+ Add deadline</LinkButton></div>}
      </div>
      <div className={panel ? "grid items-start gap-6 xl:grid-cols-[minmax(0,724fr)_minmax(0,412fr)]" : "grid gap-6"}>
        <Panel title="Upcoming deadlines" className={panel ? "order-2 xl:order-1" : undefined}>
          {upcoming.length === 0 ? <Empty>Nothing due in this view.</Empty> : <Table rows={upcoming} hrefFor={hrefFor} />}
          <Notice title="Owner reminders are on" className="mt-4">Email reminders go to the assigned owner before the due date. Keep the owner and due date current.</Notice>
        </Panel>
        {panel && (
          <Panel title={editing ? "Edit deadline" : "New deadline"} className="order-1 xl:order-2">
            <ActionForm key={editing ? editing.id : "new"} action={saveDeadline} submitLabel={editing ? "Save changes" : "Add deadline"} pendingLabel="Saving" secondary={<LinkButton href={withKeep({})}>Cancel</LinkButton>}>
              <input type="hidden" name="id" value={editing ? editing.id : ""} />
              <input type="hidden" name="returnTo" value={withKeep({})} />
              <TextField name="title" label="Title" defaultValue={editing ? editing.title : ""} required />
              <SelectField name="grantId" label="Grant" choices={fixedGrant ? grants.filter((choice) => choice.value === fixedGrant) : grants} defaultValue={editing ? editing.grantId : fixedGrant ? fixedGrant : search.grant} />
              <SelectField name="type" label="Type" choices={choicesFrom(deadlineTypeLabels)} defaultValue={editing ? editing.type : "report"} />
              <TextField name="dueOn" label="Due date" type="date" defaultValue={editing ? editing.dueOn : ""} required />
              <SelectField name="ownerId" label="Owner" choices={owners} placeholder="No owner" defaultValue={editing && editing.ownerId ? editing.ownerId : ""} />
              <SelectField name="status" label="Status" choices={choicesFrom(deadlineStatusLabels)} defaultValue={editing ? editing.status : "open"} />
              <SelectField name="reminderDays" label="Email reminder" choices={reminders(editing?.reminderDays)} defaultValue={editing ? String(editing.reminderDays) : "7"} />
              <TextAreaField name="description" label="Notes · Optional" defaultValue={editing && editing.description ? editing.description : ""} />
            </ActionForm>
            {editing?.lastEdit && (
              <p className="mt-3 text-xs text-muted-foreground">
                Last edited by {editing.lastEdit.by ? editing.lastEdit.by : "System"} · {formatMoment(editing.lastEdit.at, timeZone)}
              </p>
            )}
          </Panel>
        )}
      </div>
      {later.length > 0 && (
        <Panel title="Later" action={<ToneBadge tone="mint">Outside the 30-day filter</ToneBadge>}>
          <Table rows={later} hrefFor={hrefFor} />
        </Panel>
      )}
      {done.length > 0 && (
        <Panel title="Completed and waived">
          <Table rows={done} hrefFor={hrefFor} />
        </Panel>
      )}
    </>
  );
}
