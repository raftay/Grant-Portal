import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { addGrant } from "@/app/actions/records";
import { GrantForm } from "@/components/grants/grant-form";
import { Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { ownerChoices } from "@/server/choices";
import { pageContext } from "@/server/page";
import { listGrants } from "@/server/services/grants";

export const metadata: Metadata = { title: "New grant" };

export default async function NewGrantPage() {
  const { identity, canWrite } = await pageContext();
  if (!canWrite) notFound();
  const [owners, grants] = await Promise.all([ownerChoices(identity), listGrants(identity)]);
  return (
    <Page crumb="Grants / New" eyebrow="Grants" title="New grant" lead="Add the award details. Upload the contract afterwards and AI can propose its deadlines.">
      <Panel className="max-w-3xl">
        <GrantForm action={addGrant} owners={owners} order={grants.length + 1} />
      </Panel>
    </Page>
  );
}
