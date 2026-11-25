import { writeFileSync } from "node:fs";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../src/db/schema";

const groups: Array<[string, string[]]> = [
  ["Identity", ["users", "user_credentials", "accounts", "verification_tokens", "auth_tokens", "login_attempts"]],
  [
    "Organisation, documents, grants and deadlines",
    ["organization_profile", "files", "documents", "document_versions", "grants", "grant_contacts", "grant_links", "deadlines"],
  ],
  ["Alerts, AI and audit", ["notifications", "email_messages", "ai_extractions", "ai_proposals", "audit_log"]],
  ["Budgets and imports (Phase 2)", ["budget_categories", "budgets", "budget_lines", "imports", "import_rows"]],
  [
    "Receipts, payroll and warnings (Phase 2)",
    [
      "receipts",
      "receipt_allocations",
      "employees",
      "employee_splits",
      "payroll_runs",
      "payroll_entries",
      "payroll_allocations",
      "warnings",
    ],
  ],
];

const tables = Object.values(schema as Record<string, unknown>).filter((value) => value instanceof PgTable).map((table) => getTableConfig(table as PgTable));
const byName = new Map(tables.map((table) => [table.name, table]));
const grouped = groups.flatMap(([, names]) => names);
if (grouped.length !== tables.length) throw new Error("Every table must belong to one group");

function attributes(name: string): string {
  const table = byName.get(name)!;
  const lines = table.columns.map((column) => {
    const type = column.getSQLType().replace("timestamp with time zone", "timestamptz");
    return `    +${type} ${column.name}${column.notNull ? "" : "?"}`;
  });
  return [`  class ${name} {`, ...lines, "  }"].join("\n");
}

type Edge = { from: string; to: string; text: string };

const edges: Edge[] = tables.flatMap((table) =>
  table.foreignKeys.map((key) => {
    const reference = key.reference();
    const columns = reference.columns.map((column) => column.name);
    const parent = getTableConfig(reference.foreignTable).name;
    const optional = reference.columns.some((column) => !column.notNull);
    const single =
      columns.length === 1 &&
      (reference.columns[0]!.isUnique || reference.columns[0]!.primary);
    return {
      from: parent,
      to: table.name,
      text: `  ${parent} "${optional ? "0..1" : "1"}" ${key.onDelete === "cascade" ? "*--" : "-->"} "${single ? "0..1" : "0..*"}" ${table.name} : ${columns.join(" + ")}`,
    };
  }),
);

const overview = new Map<string, Edge>();
for (const edge of edges) {
  if (edge.from === "users") continue;
  const key = `${edge.from}:${edge.to}`;
  if (!overview.has(key)) overview.set(key, edge);
}

const fence = (lines: string[]) => ["```mermaid", "classDiagram", "  direction LR", ...lines, "```"].join("\n");

const output = [
  "# Database UML",
  "",
  "Generated from `src/db/schema` by `npm run docs:uml`. Do not edit by hand.",
  "",
  "- A trailing `?` marks a nullable column.",
  "- Multiplicities come from the foreign keys. A filled diamond means child rows are deleted with their parent, which the database permits only for drafts and unconfirmed imports.",
  "- In the detailed diagrams, a class without attributes belongs to another section.",
  "",
  "## Overview",
  "",
  "All 32 tables. Links to `users` (owner, creator, approver) are left out here and shown in the detailed diagrams.",
  "",
  fence([...grouped.map((name) => `  class ${name}`), ...[...overview.values()].map((edge) => edge.text.replace(/ : .*/, ""))]),
  ...groups.flatMap(([title, names]) => [
    "",
    `## ${title}`,
    "",
    fence([...names.map(attributes), ...edges.filter((edge) => names.includes(edge.to)).map((edge) => edge.text)]),
  ]),
  "",
].join("\n");

writeFileSync("documentation/02-database-uml.md", output);
console.log(`Wrote ${tables.length} tables and ${edges.length} relationships`);
