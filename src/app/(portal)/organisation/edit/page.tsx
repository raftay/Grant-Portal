import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveProfile } from "@/app/actions/records";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/fields";
import { LinkButton } from "@/components/link-button";
import { Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { pageContext } from "@/server/page";
import { getOrganization } from "@/server/services/organization";

export const metadata: Metadata = { title: "Edit profile" };

const months = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2023, index, 1))),
}));
const zones = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"];
const text = (value: string | null) => (value === null ? "" : value);

export default async function EditOrganisationPage() {
  const { identity, canWrite } = await pageContext();
  if (!canWrite) notFound();
  const profile = await getOrganization(identity);
  const choices = zones.includes(profile.timezone) ? zones : [profile.timezone, ...zones];
  return (
    <Page crumb="Organisation / Edit profile" eyebrow="Organisation" title="Edit profile">
      <Panel className="max-w-3xl">
        <ActionForm action={saveProfile} submitLabel="Save changes" pendingLabel="Saving" secondary={<LinkButton href="/organisation">Cancel</LinkButton>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="legalName" label="Legal name" defaultValue={profile.legalName} required />
            <TextField name="ein" label="EIN" defaultValue={text(profile.ein)} placeholder="12-3456789" />
            <TextField name="addressLine1" label="Address line 1" defaultValue={text(profile.addressLine1)} />
            <TextField name="addressLine2" label="Address line 2" defaultValue={text(profile.addressLine2)} />
            <TextField name="city" label="City" defaultValue={text(profile.city)} />
            <TextField name="state" label="State" defaultValue={text(profile.state)} />
            <TextField name="postalCode" label="ZIP code" defaultValue={text(profile.postalCode)} />
            <SelectField name="timezone" label="Time zone" defaultValue={profile.timezone} choices={choices.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") }))} />
            <SelectField name="fiscalYearStartMonth" label="Fiscal year starts in" defaultValue={String(profile.fiscalYearStartMonth)} choices={months} />
            <TextField name="fiscalYearStartDay" label="On day" type="number" min={1} max={31} defaultValue={profile.fiscalYearStartDay} />
            <TextField name="signerName" label="Authorised signer" defaultValue={text(profile.signerName)} />
            <TextField name="signerTitle" label="Signer’s title" defaultValue={text(profile.signerTitle)} />
            <TextField name="signerEmail" label="Signer’s email" type="email" defaultValue={text(profile.signerEmail)} />
          </div>
        </ActionForm>
      </Panel>
    </Page>
  );
}
