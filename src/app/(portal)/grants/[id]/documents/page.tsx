import type { Metadata } from "next";
import { ToneBadge } from "@/components/badges";
import { DocumentTable } from "@/components/documents/table";
import { NewDocument } from "@/components/documents/upload";
import { Notice, Panel } from "@/components/panels";
import { grantTabs, Page } from "@/components/shell/page";
import { grantCategories, ownerChoices } from "@/server/choices";
import { found, pageContext, requireId } from "@/server/page";
import { listDocuments } from "@/server/services/documents";
import { getGrant } from "@/server/services/grants";
import { getOrganization } from "@/server/services/organization";

export const metadata: Metadata = { title: "Grant documents" };

export default async function GrantDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = requireId((await params).id);
  const { identity, canWrite } = await pageContext();
  const [grant, documents, profile, owners] = await Promise.all([
    found(getGrant(identity, id)),
    listDocuments(identity, { grantId: id }),
    getOrganization(identity),
    ownerChoices(identity),
  ]);
  return (
    <Page crumb="Grants / Documents" eyebrow={grant.name} title="Grant documents" lead="Contracts, reports and supporting records for this grant only." tabs={grantTabs(id, "documents")}>
      <div className={canWrite ? "grid items-start gap-6 xl:grid-cols-[minmax(0,724fr)_minmax(0,412fr)]" : "grid gap-6"}>
        <Panel title="Documents" action={<ToneBadge tone="mint">{documents.length === 1 ? "1 file" : `${documents.length} files`}</ToneBadge>}>
          <DocumentTable rows={documents} timeZone={profile.timezone} empty="No documents for this grant yet." />
          <Notice title="Files stay private" className="mt-4">Only authorised organisation members can view or download these grant records.</Notice>
        </Panel>
        {canWrite && (
          <Panel title="New document">
            <NewDocument grantId={id} owners={owners} categories={grantCategories} />
          </Panel>
        )}
      </div>
    </Page>
  );
}
