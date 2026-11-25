import type { Metadata } from "next";
import { Contacts, Links } from "@/components/grants/contact-forms";
import { Panel } from "@/components/panels";
import { grantTabs, Page } from "@/components/shell/page";
import { found, pageContext, requireId } from "@/server/page";
import { getGrant } from "@/server/services/grants";

export const metadata: Metadata = { title: "Contacts and links" };

export default async function GrantContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const id = requireId((await params).id);
  const { identity, canWrite } = await pageContext();
  const grant = await found(getGrant(identity, id));
  const contacts = grant.contacts.map(({ id: contactId, name, title, agency, email, phone, isPrimary }) => ({ id: contactId, name, title, agency, email, phone, isPrimary }));
  const links = grant.links.map(({ id: linkId, label, url }) => ({ id: linkId, label, url }));
  return (
    <Page crumb="Grants / Contacts & links" eyebrow={grant.name} title="Contacts & links" lead="Who to call at the agency, and where to file." tabs={grantTabs(id, "contacts")}>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Agency contacts"><Contacts grantId={id} contacts={contacts} canWrite={canWrite} /></Panel>
        <Panel title="Funder portal links"><Links grantId={id} links={links} canWrite={canWrite} /></Panel>
      </div>
    </Page>
  );
}
