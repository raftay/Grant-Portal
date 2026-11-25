import Link from "next/link";
import { ToneBadge, type Tone } from "@/components/badges";
import { FileLinks } from "@/components/link-button";
import { Empty } from "@/components/panels";
import { todayIn, type DocumentState } from "@/lib/dates";
import { formatBytes, formatDay } from "@/lib/format";
import { categoryLabels, documentStateLabels, fileTypeLabels } from "@/lib/labels";
import type { listDocuments } from "@/server/services/documents";

type Row = Awaited<ReturnType<typeof listDocuments>>[number];

const tones: Record<DocumentState, Tone> = { expired: "danger", review_overdue: "danger", expiring: "warn", review_due: "warn", current: "mint" };

export function dateLine(row: { expiresOn: string | null; reviewOn: string | null; state: DocumentState }): string {
  const expiry = row.expiresOn && `${row.state === "expired" ? "Expired" : "Expires"} ${formatDay(row.expiresOn)}`;
  const review = row.reviewOn && `Review ${formatDay(row.reviewOn)}`;
  return [expiry, review].filter(Boolean).join(" · ");
}

export const StateBadge = ({ state }: { state: DocumentState }) => <ToneBadge tone={tones[state]}>{documentStateLabels[state]}</ToneBadge>;

export function DocumentTable({ rows, timeZone, empty }: { rows: Row[]; timeZone: string; empty: string }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <table className="stack-table">
      <thead>
        <tr>
          <th scope="col">Document</th>
          <th scope="col">Owner / updated</th>
          <th scope="col">Expiry or review</th>
          <th scope="col">Status</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td data-label="Document">
              <span>
                <Link href={`/documents/${row.id}`} className="font-semibold hover:underline">{row.title}</Link>
                <span className="block text-xs font-normal text-muted-foreground">
                  {categoryLabels[row.category]}
                  {row.mimeType && row.sizeBytes !== null && ` · ${fileTypeLabels[row.mimeType]} · ${formatBytes(row.sizeBytes)}`}
                </span>
              </span>
            </td>
            <td data-label="Owner / updated">
              <span>
                {row.ownerName ? row.ownerName : "No owner"}
                {row.uploadedAt && <span className="block text-xs">{formatDay(todayIn(timeZone, row.uploadedAt))}</span>}
              </span>
            </td>
            <td data-label="Expiry or review">{dateLine(row) || "No dates"}</td>
            <td data-label="Status" className="whitespace-nowrap"><StateBadge state={row.state} /></td>
            <td data-label="Actions">{row.fileId && <FileLinks fileId={row.fileId} name={row.title} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
