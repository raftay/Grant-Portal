import type { Metadata } from "next";
import { DocumentTable } from "@/components/documents/table";
import { NewDocument } from "@/components/documents/upload";
import { LinkButton } from "@/components/link-button";
import { Notice, Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { ownerChoices, organizationCategories } from "@/server/choices";
import { pageContext } from "@/server/page";
import { listDocuments } from "@/server/services/documents";
import { getOrganization } from "@/server/services/organization";

export const metadata: Metadata = { title: "Document library" };

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { identity, canWrite } = await pageContext();
  const adding = canWrite && (await searchParams).new === "1";
  const [documents, profile, owners] = await Promise.all([listDocuments(identity, { grantId: null }), getOrganization(identity), ownerChoices(identity)]);
  return (
    <Page
      crumb="Organisation / Document library"
      eyebrow="Organisation"
      title="Document library"
      lead="W-9, insurance, policies and other records for the whole organisation."
      actions={canWrite && !adding && <LinkButton href="/organisation/documents?new=1" variant="default">+ Upload document</LinkButton>}
      tabs={[
        { href: "/organisation", label: "Profile", active: false },
        { href: "/organisation/documents", label: "Document library", active: true },
      ]}
    >
      <div className={adding ? "grid items-start gap-6 xl:grid-cols-[minmax(0,724fr)_minmax(0,412fr)]" : "grid gap-6"}>
        <Panel title="Documents" className={adding ? "order-2 xl:order-1" : undefined}>
          <DocumentTable rows={documents} timeZone={profile.timezone} empty="No documents yet." />
          <Notice title="Files stay private" className="mt-4">Only authorised organisation members can view or download these records.</Notice>
        </Panel>
        {adding && (
          <Panel title="New document" action={<LinkButton href="/organisation/documents">Close</LinkButton>} className="order-1 xl:order-2">
            <NewDocument grantId="" owners={owners} categories={organizationCategories} />
          </Panel>
        )}
      </div>
    </Page>
  );
}
