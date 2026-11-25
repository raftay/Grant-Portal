import type { Metadata } from "next";
import { FilterSelect } from "@/components/forms/quick";
import { LinkButton } from "@/components/link-button";
import { Empty, Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { formatMoment } from "@/lib/format";
import { adminContext } from "@/server/page";
import { getOrganization } from "@/server/services/organization";
import { listAudit } from "@/server/services/overview";

export const metadata: Metadata = { title: "Audit log" };

const kinds = ["users", "organization_profile", "documents", "document_versions", "files", "grants", "grant_contacts", "grant_links", "deadlines", "ai_extractions", "ai_proposals", "jobs"];
const quiet = new Set(["id", "created_at", "updated_at"]);

const show = (value: unknown) => (value === null || value === undefined ? "—" : typeof value === "string" ? value : JSON.stringify(value));

function changes(before: unknown, after: unknown): [string, string, string][] {
  const then = (before ? before : {}) as Record<string, unknown>;
  const now = (after ? after : {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(then), ...Object.keys(now)])]
    .filter((name) => !quiet.has(name) && JSON.stringify(then[name]) !== JSON.stringify(now[name]))
    .map((name) => [name, show(then[name]), show(now[name])]);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ type?: string; before?: string }> }) {
  const { identity } = await adminContext();
  const { type, before } = await searchParams;
  const [rows, profile] = await Promise.all([
    listAudit(identity, { entityType: type ? type : undefined, before: before ? Number(before) : undefined }),
    getOrganization(identity),
  ]);
  const last = rows.at(-1);
  return (
    <Page crumb="Settings / Audit log" eyebrow="Admin settings" title="Audit log" lead="Every upload, approval and edit, with who and when. Entries cannot be changed.">
      <form action="/settings/audit" className="flex">
        <FilterSelect name="type" label="Record type" current={type ? type : ""} choices={[{ value: "", label: "All records" }, ...kinds.map((kind) => ({ value: kind, label: kind.replaceAll("_", " ") }))]} />
      </form>
      <Panel>
        {rows.length === 0 ? (
          <Empty>No entries.</Empty>
        ) : (
          <ul>
            {rows.map((row) => {
              const list = changes(row.before, row.after);
              return (
                <li key={row.id} className="border-b py-3 last:border-0">
                  <details>
                    <summary className="flex cursor-pointer flex-wrap justify-between gap-x-4 gap-y-1">
                      <span className="font-medium">{row.action.replace(/[._]/g, " ")} · {row.entityType.replaceAll("_", " ")}</span>
                      <span className="text-muted-foreground">{row.actorName ? row.actorName : "System"} · {formatMoment(row.occurredAt, profile.timezone)}</span>
                    </summary>
                    <div className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                      {list.length === 0 ? (
                        <p className="text-muted-foreground">No field changes recorded.</p>
                      ) : (
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-muted-foreground">
                              <th scope="col" className="pr-4 pb-1 font-medium">Field</th>
                              <th scope="col" className="pr-4 pb-1 font-medium">Before</th>
                              <th scope="col" className="pb-1 font-medium">After</th>
                            </tr>
                          </thead>
                          <tbody>
                            {list.map(([name, from, to]) => (
                              <tr key={name} className="align-top">
                                <td className="py-0.5 pr-4 font-medium">{name}</td>
                                <td className="max-w-72 py-0.5 pr-4 break-words">{from}</td>
                                <td className="max-w-72 py-0.5 break-words">{to}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
        {rows.length === 50 && last && <div className="mt-4"><LinkButton href={`/settings/audit?${new URLSearchParams({ ...(type ? { type } : {}), before: String(last.id) })}`}>Older entries</LinkButton></div>}
      </Panel>
    </Page>
  );
}
