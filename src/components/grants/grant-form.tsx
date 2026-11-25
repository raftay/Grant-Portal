import { ActionForm, type FormAction } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField, type Choice } from "@/components/forms/fields";
import { LinkButton } from "@/components/link-button";
import { centsToInput } from "@/lib/format";
import { grantStatusLabels } from "@/lib/labels";
import { choicesFrom } from "@/server/choices";

type Grant = {
  id: string;
  name: string;
  code: string;
  funderName: string;
  awardNumber: string | null;
  awardCents: number;
  awardedOn: string | null;
  startsOn: string;
  endsOn: string;
  purpose: string | null;
  ownerId: string | null;
  status: string;
  termsText: string | null;
  sortOrder: number;
};

const text = (value: string | null | undefined) => (value ? value : "");

export function GrantForm({ action, grant, owners, order }: { action: FormAction; grant?: Grant; owners: Choice[]; order: number }) {
  return (
    <ActionForm action={action} submitLabel={grant ? "Save changes" : "Create grant"} pendingLabel="Saving" secondary={<LinkButton href={grant ? `/grants/${grant.id}` : "/grants"}>Cancel</LinkButton>}>
      {grant && <input type="hidden" name="id" value={grant.id} />}
      <input type="hidden" name="sortOrder" value={grant ? grant.sortOrder : order} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Grant name" defaultValue={text(grant?.name)} required />
        <TextField name="code" label="Short code" defaultValue={text(grant?.code)} placeholder="CW-2026" required />
        <TextField name="funderName" label="Funder" defaultValue={text(grant?.funderName)} required />
        <TextField name="awardNumber" label="Award reference" defaultValue={text(grant?.awardNumber)} />
        <TextField name="award" label="Award amount (US$)" inputMode="decimal" defaultValue={grant ? centsToInput(grant.awardCents) : ""} placeholder="150,000.00" required />
        <TextField name="awardedOn" label="Approved on · Optional" type="date" defaultValue={text(grant?.awardedOn)} />
        <TextField name="startsOn" label="Grant period starts" type="date" defaultValue={text(grant?.startsOn)} required />
        <TextField name="endsOn" label="Grant period ends" type="date" defaultValue={text(grant?.endsOn)} required />
        <SelectField name="ownerId" label="Grant owner" choices={owners} placeholder="No owner" defaultValue={text(grant?.ownerId)} />
        <SelectField name="status" label="Status" choices={choicesFrom(grantStatusLabels)} defaultValue={grant ? grant.status : "active"} />
      </div>
      <TextAreaField name="purpose" label="Purpose" defaultValue={text(grant?.purpose)} />
      <TextAreaField name="termsText" label="Spending terms" hint="What the grant does and does not allow. Used for checks in Phase 2." defaultValue={text(grant?.termsText)} />
    </ActionForm>
  );
}
