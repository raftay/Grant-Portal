import type { Metadata } from "next";
import Link from "next/link";
import { ToneBadge } from "@/components/badges";
import { dateLine, StateBadge } from "@/components/documents/table";
import { CopyField } from "@/components/forms/quick";
import { LinkButton } from "@/components/link-button";
import { Empty, Notice, Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { formatFiscalYear } from "@/lib/format";
import { env } from "@/server/env";
import { pageContext } from "@/server/page";
import { listDocuments } from "@/server/services/documents";
import { getOrganization } from "@/server/services/organization";

export const metadata: Metadata = { title: "Organisation profile" };

export default async function OrganisationPage() {
  const { identity, canWrite } = await pageContext();
  const [profile, documents] = await Promise.all([getOrganization(identity), listDocuments(identity, { grantId: null })]);
  const address = [profile.addressLine1, profile.addressLine2, profile.city, [profile.state, profile.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const signer = [profile.signerName, profile.signerTitle].filter(Boolean).join(", ");
  const details: [string, string | null][] = [
    ["Legal name", profile.legalName],
    ["EIN", profile.ein],
    ["Address", address],
    ["Fiscal year", formatFiscalYear(profile.fiscalYearStartMonth, profile.fiscalYearStartDay)],
    ["Authorised signer", signer],
  ];
  return (
    <Page
      crumb="Organisation / Profile"
      eyebrow="Organisation"
      title="Organisation profile"
      lead="Your reusable details and essential records."
      actions={canWrite && <LinkButton href="/organisation/edit" variant="default">Edit profile</LinkButton>}
      tabs={[
        { href: "/organisation", label: "Profile", active: true },
        { href: "/organisation/documents", label: "Document library", active: false },
      ]}
    >
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,440fr)_minmax(0,696fr)]">
        <Panel title="Organisation details">
          {details.map(([label, value]) =>
            value ? (
              <CopyField key={label} label={label} value={value} />
            ) : (
              <div key={label} className="border-b py-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-0.5 text-muted-foreground">Not set</p>
              </div>
            ),
          )}
          {env().SAMPLE_DATA === "true" && <ToneBadge tone="mint" className="mt-4">Fictional organisation · Sample data</ToneBadge>}
        </Panel>
        <Panel title="Document library" action={canWrite && <LinkButton href="/organisation/documents?new=1">+ Upload</LinkButton>}>
          <p className="mb-3 text-muted-foreground">Private records, ready when you need them.</p>
          {documents.length === 0 ? (
            <Empty>No documents yet.</Empty>
          ) : (
            <table className="stack-table">
              <thead>
                <tr>
                  <th scope="col">Document / owner</th>
                  <th scope="col">Expiry or review</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((row) => (
                  <tr key={row.id}>
                    <td data-label="Document">
                      <Link href={`/documents/${row.id}`} className="hover:underline">
                        {row.title}
                        {row.ownerName && ` · ${row.ownerName}`}
                      </Link>
                    </td>
                    <td data-label="Expiry or review">{dateLine(row) || "No dates"}</td>
                    <td data-label="Status"><StateBadge state={row.state} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 text-xs text-muted-foreground">Select a document to view, download or replace it.</p>
        </Panel>
      </div>
      <Notice title="Dates suggested by AI are yours to confirm." action={canWrite && <LinkButton href="/organisation/documents?new=1">Review an upload →</LinkButton>}>
        On upload, review the proposed expiry date, review date and document owner before saving.
      </Notice>
    </Page>
  );
}
