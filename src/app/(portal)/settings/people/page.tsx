import type { Metadata } from "next";
import { reinvite, setActive, setPayroll, setRole } from "@/app/actions/records";
import { ToneBadge } from "@/components/badges";
import { ActionButton, QuickSelect } from "@/components/forms/quick";
import { InviteDialog } from "@/components/invite-dialog";
import { Empty, Notice, Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { describeAccessChange } from "@/lib/activity";
import { formatMoment } from "@/lib/format";
import { roleLabels, userStatusLabels } from "@/lib/labels";
import { choicesFrom } from "@/server/choices";
import { adminContext } from "@/server/page";
import { getOrganization } from "@/server/services/organization";
import { listAccessChanges } from "@/server/services/overview";
import { listUsers, seatLimit } from "@/server/services/users";

export const metadata: Metadata = { title: "People & permissions" };

const roleNotes = [
  ["Admin", "Full access. Invite and deactivate users, change roles and approve payroll access."],
  ["Staff", "Create and edit grant records, documents, deadlines, budgets and receipts."],
  ["View-only", "Read permitted records. No creating, editing, importing or confirming."],
];

export default async function PeoplePage() {
  const { user, identity } = await adminContext();
  const [{ people, seatsUsed, payrollUsers }, changes, profile] = await Promise.all([listUsers(identity), listAccessChanges(identity), getOrganization(identity)]);
  const free = seatLimit - seatsUsed;
  const described = changes.flatMap((row) => {
    const textLine = describeAccessChange(row.before, row.after);
    return textLine ? [{ ...row, textLine }] : [];
  });
  return (
    <Page crumb="Settings / People & permissions" eyebrow="Admin settings" title="People & permissions" lead="Give your team the right access, and keep sensitive payroll private." actions={<InviteDialog full={free === 0} />}>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <p className="text-[20px] font-semibold">{seatsUsed} of {seatLimit} accounts in use</p>
          <p className="mt-2 text-muted-foreground">{free === 1 ? "1 invitation" : `${free} invitations`} available · Any mix of Admin, Staff and View-only</p>
        </Panel>
        <Panel>
          <p className="text-[20px] font-semibold">{payrollUsers} approved payroll {payrollUsers === 1 ? "user" : "users"}</p>
          <p className="mt-2 text-muted-foreground">Payroll access is separate from a person’s role.</p>
        </Panel>
      </div>
      <Panel>
        <table className="stack-table">
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Role</th>
              <th scope="col">Payroll access</th>
              <th scope="col">Status</th>
              <th scope="col">Manage</th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.id}>
                <td data-label="Person">
                  <span className="min-w-0">
                    <span className="block">{person.name}</span>
                    <span className="block text-xs font-normal break-all text-muted-foreground">{person.email}</span>
                  </span>
                </td>
                <td data-label="Role">
                  <QuickSelect action={setRole} values={{ id: person.id }} current={person.role} choices={choicesFrom(roleLabels)} label={`Role for ${person.name}`} />
                </td>
                <td data-label="Payroll access">
                  <QuickSelect action={setPayroll} values={{ id: person.id }} current={String(person.canViewPayroll)} choices={[{ value: "true", label: "✓ Approved" }, { value: "false", label: "Not approved" }]} label={`Payroll access for ${person.name}`} />
                </td>
                <td data-label="Status"><ToneBadge tone={person.status === "active" ? "mint" : person.status === "invited" ? "warn" : "plain"}>{userStatusLabels[person.status]}</ToneBadge></td>
                <td data-label="Manage">
                  <span className="inline-flex flex-wrap justify-end gap-3 md:justify-start">
                    {person.id === user.id && "You"}
                    {person.status === "invited" && <ActionButton variant="link" action={reinvite} values={{ id: person.id }} label="Resend invite" pendingLabel="Sending" />}
                    {person.id !== user.id && person.status !== "deactivated" && (
                      <ActionButton variant="link" action={setActive} values={{ id: person.id, value: "false" }} label="Deactivate" pendingLabel="Deactivating" confirm={{ title: `Deactivate ${person.name}?`, body: "They are signed out straight away and their seat is freed." }} />
                    )}
                    {person.status === "deactivated" && <ActionButton variant="link" action={setActive} values={{ id: person.id, value: "true" }} label="Reactivate" pendingLabel="Reactivating" />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <div className="grid gap-5 md:grid-cols-3">
        {roleNotes.map(([title, note]) => (
          <Panel key={title} title={title}><p className="text-muted-foreground">{note}</p></Panel>
        ))}
      </div>
      <Notice title="Private by default">People without payroll approval do not see payroll navigation or records. Deactivated users lose access to the organisation.</Notice>
      <Panel title="Recent access changes">
        {described.length === 0 ? (
          <Empty>No changes yet.</Empty>
        ) : (
          <table className="stack-table">
            <thead>
              <tr>
                <th scope="col">Change</th>
                <th scope="col">Changed by</th>
                <th scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {described.map((row) => (
                <tr key={row.id}>
                  <td data-label="Change">{row.textLine}</td>
                  <td data-label="Changed by">{row.actorName ? row.actorName : "System"}</td>
                  <td data-label="When">{formatMoment(row.occurredAt, profile.timezone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </Page>
  );
}
