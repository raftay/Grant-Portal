import type { Metadata } from "next";
import { retireDocument, saveDocument } from "@/app/actions/records";
import { StateBadge, dateLine } from "@/components/documents/table";
import { ReplaceFile } from "@/components/documents/upload";
import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { ActionButton } from "@/components/forms/quick";
import { FileLinks } from "@/components/link-button";
import { Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { formatBytes, formatMoment } from "@/lib/format";
import { categoryLabels, fileTypeLabels } from "@/lib/labels";
import { choicesFrom, grantCategories, organizationCategories, ownerChoices } from "@/server/choices";
import { found, pageContext, requireId } from "@/server/page";
import { getDocument } from "@/server/services/documents";
import { getOrganization } from "@/server/services/organization";

export const metadata: Metadata = { title: "Document" };

const text = (value: string | null) => (value === null ? "" : value);

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const id = requireId((await params).id);
  const { identity, canWrite } = await pageContext();
  const [document, profile, owners] = await Promise.all([found(getDocument(identity, id)), getOrganization(identity), ownerChoices(identity)]);
  const editable = canWrite && !document.archivedAt;
  const current = document.versions[0];
  const contract = document.category === "executed_contract";
  const categories = contract ? choicesFrom({ executed_contract: categoryLabels.executed_contract }) : document.grantId ? grantCategories : organizationCategories;
  const listed = categories.some((choice) => choice.value === document.category) ? categories : [{ value: document.category, label: categoryLabels[document.category] }, ...categories];
  return (
    <Page
      crumb={document.grantId ? "Grants / Document" : "Organisation / Document"}
      eyebrow={categoryLabels[document.category]}
      title={document.title}
      lead={
        <span className="flex flex-wrap items-center gap-2">
          <StateBadge state={document.state} /> {document.archivedAt ? "Archived" : dateLine(document) || "No expiry or review date"}
        </span>
      }
      actions={
        editable && (
          <ActionButton
            action={retireDocument}
            values={{ id, grantId: text(document.grantId) }}
            label="Archive"
            pendingLabel="Archiving"
            confirm={{ title: "Archive this document?", body: "It leaves the library and stops sending alerts. Its history is kept." }}
          />
        )
      }
    >
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Details">
          {editable ? (
            <ActionForm action={saveDocument} submitLabel="Save changes" pendingLabel="Saving">
              <input type="hidden" name="id" value={id} />
              <TextField name="title" label="Title" defaultValue={document.title} required />
              <SelectField name="category" label="Document type" choices={listed} defaultValue={document.category} />
              <SelectField name="ownerId" label="Owner" choices={owners} placeholder="No owner" defaultValue={text(document.ownerId)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="expiresOn" label="Expiration date · Optional" type="date" defaultValue={text(document.expiresOn)} />
                <TextField name="reviewOn" label="Next review date · Optional" type="date" defaultValue={text(document.reviewOn)} />
              </div>
              <TextAreaField name="notes" label="Notes" defaultValue={text(document.notes)} />
            </ActionForm>
          ) : (
            <p className="text-muted-foreground">{document.notes ? document.notes : "No notes."}</p>
          )}
        </Panel>
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Versions" action={current && <FileLinks fileId={current.fileId} name={document.title} />}>
            <ul>
              {document.versions.map((version, index) => (
                <li key={version.fileId} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0">
                  <span className="min-w-0">
                    <span className="block font-medium break-words">
                      Version {version.versionNo}{index === 0 && " · current"} · {version.fileName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fileTypeLabels[version.mimeType]} · {formatBytes(version.sizeBytes)} · {version.uploadedBy ? version.uploadedBy : "System"} · {formatMoment(version.uploadedAt, profile.timezone)}
                    </span>
                  </span>
                  {index > 0 && <FileLinks fileId={version.fileId} name={`version ${version.versionNo}`} />}
                </li>
              ))}
            </ul>
          </Panel>
          {editable && (
            <Panel title="Replace the file">
              <ReplaceFile documentId={id} />
            </Panel>
          )}
        </div>
      </div>
      {current && ["application/pdf", "image/png", "image/jpeg"].includes(current.mimeType) && (
        <Panel title="Preview">
          <iframe src={`/api/files/${current.fileId}?mode=view`} title={`Preview of ${document.title}`} className="h-[70dvh] w-full rounded-lg border bg-muted" />
        </Panel>
      )}
    </Page>
  );
}
