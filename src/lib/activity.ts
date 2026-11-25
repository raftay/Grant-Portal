const nouns: Record<string, string> = {
  organization_profile: "Organisation profile",
  documents: "Document",
  document_versions: "File",
  grants: "Grant",
  grant_contacts: "Contact",
  grant_links: "Link",
  deadlines: "Deadline",
  budgets: "Budget",
  receipts: "Receipt",
};
const verbs: Record<string, string> = { insert: "added", update: "updated", delete: "removed" };

export function describeActivity(row: { action: string; entityType: string; label: string | null }): string {
  const noun = nouns[row.entityType];
  const verb = verbs[row.action];
  if (!noun || !verb) throw new Error(`No wording for ${row.entityType} ${row.action}`);
  if (row.entityType === "document_versions") return `${row.label} replaced`;
  if (row.entityType === "organization_profile") return `${noun} ${verb}`;
  return row.label ? `${row.label} ${verb}` : `${noun} ${verb}`;
}

type UserSnapshot = { name: string; email: string; role: "admin" | "staff" | "viewer"; status: string; can_view_payroll: boolean };

const roles = { admin: "Admin", staff: "Staff", viewer: "View-only" } as const;

export function describeAccessChange(before: unknown, after: unknown): string | undefined {
  const now = after as UserSnapshot;
  const then = before as UserSnapshot | null;
  if (!then) return `${now.name} ${now.status === "invited" ? "invited" : "added"} as ${roles[now.role]}`;
  if (then.status !== now.status) {
    if (now.status === "deactivated") return `${now.name} deactivated`;
    return then.status === "invited" ? `${now.name} accepted the invitation` : `${now.name} reactivated`;
  }
  if (then.role !== now.role) return `${now.name} changed from ${roles[then.role]} to ${roles[now.role]}`;
  if (then.can_view_payroll !== now.can_view_payroll) return `Payroll access ${now.can_view_payroll ? "approved" : "removed"} for ${now.name}`;
  if (then.email !== now.email) return `Email changed for ${now.name}`;
  return undefined;
}
