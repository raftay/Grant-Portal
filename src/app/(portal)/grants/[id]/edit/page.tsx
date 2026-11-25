import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { editGrant } from "@/app/actions/records";
import { GrantForm } from "@/components/grants/grant-form";
import { Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { ownerChoices } from "@/server/choices";
import { found, pageContext, requireId } from "@/server/page";
import { getGrant } from "@/server/services/grants";

export const metadata: Metadata = { title: "Edit grant" };

export default async function EditGrantPage({ params }: { params: Promise<{ id: string }> }) {
  const id = requireId((await params).id);
  const { identity, canWrite } = await pageContext();
  if (!canWrite) notFound();
  const [grant, owners] = await Promise.all([found(getGrant(identity, id)), ownerChoices(identity)]);
  return (
    <Page crumb={`Grants / ${grant.name}`} eyebrow={`Grant workspace · ${grant.code}`} title="Edit grant">
      <Panel className="max-w-3xl">
        <GrantForm action={editGrant} grant={grant} owners={owners} order={grant.sortOrder} />
      </Panel>
    </Page>
  );
}
