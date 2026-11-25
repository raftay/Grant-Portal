import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { startContractReading } from "@/app/actions/files";
import { ContractUpload, ReadingForm } from "@/components/documents/upload";
import { FileLinks, LinkButton } from "@/components/link-button";
import { Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { found, pageContext, requireId } from "@/server/page";
import { getGrant } from "@/server/services/grants";

export const metadata: Metadata = { title: "Contract" };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const id = requireId((await params).id);
  const { identity, canWrite } = await pageContext();
  if (!canWrite) notFound();
  const grant = await found(getGrant(identity, id));
  return (
    <Page crumb="Grants / Contract" eyebrow={`${grant.name} · Contract`} title="Executed contract" lead="Upload the signed contract, then let AI propose its award details and deadlines." actions={<LinkButton href={`/grants/${id}`}>Back to grant</LinkButton>}>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title={grant.contract ? "Current file" : "Upload"} action={grant.contract && <FileLinks fileId={grant.contract.fileId} name="contract" />}>
          {grant.contract && <p className="mb-4 font-medium break-words">{grant.contract.fileName}</p>}
          <ContractUpload grantId={id} documentId={grant.contract?.documentId} />
        </Panel>
        {grant.contract && (
          <Panel title="Propose details">
            <ReadingForm action={startContractReading} grantId={id} />
          </Panel>
        )}
      </div>
    </Page>
  );
}
