import { afterAll, describe, expect, it } from "vitest";
import { ids as i } from "../helpers/fixtures";
import { allowed, asOwner, asUser, closePools } from "../helpers/session";

afterAll(closePools);

const people = {
  adminPay: i.adminPay,
  admin: i.admin,
  staff: i.staff,
  staffPay: i.staffPay,
  viewer: i.viewer,
  viewerPay: i.viewerPay,
  deactivated: i.deactivated,
  nobody: null,
} as const;
type Person = keyof typeof people;

const none: Person[] = [];
const admins: Person[] = ["adminPay", "admin"];
const writers: Person[] = ["adminPay", "admin", "staff", "staffPay"];
const members: Person[] = [...writers, "viewer", "viewerPay"];
const payWriters: Person[] = ["adminPay", "staffPay"];
const payMembers: Person[] = [...payWriters, "viewerPay"];

type Rule = { label: string; sql: string; who: Person[] };

const read = (table: string, who: Person[], where = "true"): Rule => ({
  label: `${table} select ${where}`,
  sql: `select 1 from ${table} where ${where}`,
  who,
});
const write = (table: string, sql: string, who: Person[]): Rule => ({
  label: `${table} ${sql.split(" ")[0]} ${sql.slice(0, 70)}`,
  sql,
  who,
});
const byId = (id: string) => `id = '${id}'`;

const rules: Rule[] = [
  read("users", members),
  write("users", `update users set name = 'X' where ${byId(i.viewer)}`, admins),
  write("users", `update users set role = 'admin' where ${byId(i.staff)}`, admins),
  write("users", `update users set can_view_payroll = true where ${byId(i.viewer)}`, admins),
  write("users", `update users set session_version = 9 where ${byId(i.viewer)}`, none),
  write("users", `delete from users where ${byId(i.viewer)}`, none),
  ...["user_credentials", "accounts", "verification_tokens", "auth_tokens", "login_attempts"].flatMap((table) => [
    read(table, none),
    write(table, `delete from ${table}`, none),
  ]),
  write("user_credentials", `insert into user_credentials values ('${i.staff}', 'x')`, none),
  write("user_credentials", `update user_credentials set password_hash = 'x'`, none),
  write("auth_tokens", `insert into auth_tokens (user_id, purpose, token_hash, expires_at) values ('${i.admin}', 'invite', 'z', now())`, none),

  read("organization_profile", members),
  write("organization_profile", `update organization_profile set city = 'X'`, writers),
  write("organization_profile", `delete from organization_profile`, none),

  read("files", members, byId(i.fileGeneral)),
  read("files", payMembers, byId(i.filePayroll)),
  write("files", `insert into files (storage_key, original_name, mime_type, size_bytes) values ('n', 'n', 'n', 1)`, writers),
  write("files", `insert into files (storage_key, original_name, mime_type, size_bytes, sensitivity) values ('n', 'n', 'n', 1, 'payroll')`, payWriters),
  write("files", `update files set sha256 = 'x' where ${byId(i.fileGeneral)}`, writers),
  write("files", `update files set sha256 = 'x' where ${byId(i.filePayroll)}`, payWriters),
  write("files", `update files set sensitivity = 'payroll' where ${byId(i.fileGeneral)}`, payWriters),
  write("files", `update files set storage_key = 'x' where ${byId(i.fileGeneral)}`, none),
  write("files", `delete from files`, none),

  read("documents", members),
  write("documents", `insert into documents (title, category) values ('N', 'policy')`, writers),
  write("documents", `update documents set title = 'X'`, writers),
  write("documents", `delete from documents`, none),
  read("document_versions", members),
  write("document_versions", `insert into document_versions (document_id, version_no, file_id) values ('${i.document}', 2, '${i.fileSpare}')`, writers),
  write("document_versions", `update document_versions set version_no = 9`, none),
  write("document_versions", `delete from document_versions`, none),

  read("grants", members),
  write("grants", `insert into grants (name, code, funder_name, award_cents, starts_on, ends_on) values ('N', 'N', 'F', 1, '2026-01-01', '2026-01-02')`, writers),
  write("grants", `update grants set name = 'X' where ${byId(i.grantA)}`, writers),
  write("grants", `delete from grants`, none),
  read("grant_contacts", members),
  write("grant_contacts", `insert into grant_contacts (grant_id, name) values ('${i.grantA}', 'N')`, writers),
  write("grant_contacts", `update grant_contacts set name = 'X'`, writers),
  write("grant_contacts", `delete from grant_contacts`, writers),
  read("grant_links", members),
  write("grant_links", `insert into grant_links (grant_id, label, url) values ('${i.grantA}', 'N', 'https://n.org')`, writers),
  write("grant_links", `update grant_links set label = 'X'`, writers),
  write("grant_links", `delete from grant_links`, writers),
  read("deadlines", members),
  write("deadlines", `insert into deadlines (grant_id, type, title, due_on) values ('${i.grantA}', 'report', 'N', '2026-05-01')`, writers),
  write("deadlines", `update deadlines set title = 'X'`, writers),
  write("deadlines", `delete from deadlines`, none),

  read("email_messages", admins),
  write("email_messages", `insert into email_messages (kind, to_email, subject) values ('x', 'x', 'x')`, none),
  write("email_messages", `update email_messages set subject = 'x'`, none),
  write("email_messages", `delete from email_messages`, none),
  read("notifications", ["adminPay", "admin", "staff"], byId(i.notification)),
  read("notifications", admins, byId(i.notificationAdmin)),
  write("notifications", `update notifications set milestone = 'overdue'`, none),
  write("notifications", `delete from notifications`, none),

  read("ai_extractions", writers, byId(i.extraction)),
  read("ai_extractions", payWriters, byId(i.extractionPayroll)),
  write("ai_extractions", `insert into ai_extractions (kind, model, prompt_version) values ('contract_terms', 'm', 'v')`, writers),
  write("ai_extractions", `insert into ai_extractions (kind, model, prompt_version, sensitivity) values ('payroll_columns', 'm', 'v', 'payroll')`, payWriters),
  write("ai_extractions", `update ai_extractions set status = 'failed' where ${byId(i.extraction)}`, writers),
  write("ai_extractions", `update ai_extractions set status = 'failed' where ${byId(i.extractionPayroll)}`, payWriters),
  write("ai_extractions", `delete from ai_extractions`, none),
  read("ai_proposals", writers, byId(i.proposal)),
  read("ai_proposals", payWriters, byId(i.proposalPayroll)),
  write("ai_proposals", `insert into ai_proposals (extraction_id, target_entity, target_field, proposed_value) values ('${i.extraction}', 'x', 'x', '1')`, writers),
  write("ai_proposals", `insert into ai_proposals (extraction_id, target_entity, target_field, proposed_value) values ('${i.extractionPayroll}', 'x', 'x', '1')`, payWriters),
  write("ai_proposals", `update ai_proposals set status = 'rejected', reviewed_by = '${i.staff}', reviewed_at = now() where ${byId(i.proposal)}`, writers),
  write("ai_proposals", `update ai_proposals set status = 'rejected', reviewed_by = '${i.staff}', reviewed_at = now() where ${byId(i.proposalPayroll)}`, payWriters),
  write("ai_proposals", `update ai_proposals set proposed_value = '2' where ${byId(i.proposal)}`, none),
  write("ai_proposals", `delete from ai_proposals`, none),

  read("audit_log", admins, "sensitivity = 'general'"),
  read("audit_log", ["adminPay"], "sensitivity = 'payroll'"),
  write("audit_log", `insert into audit_log (actor_kind, action, entity_type) values ('user', 'x', 'x')`, none),
  write("audit_log", `update audit_log set action = 'x'`, none),
  write("audit_log", `delete from audit_log`, none),

  read("budget_categories", members),
  write("budget_categories", `insert into budget_categories (grant_id, name) values ('${i.grantA}', 'N')`, writers),
  write("budget_categories", `update budget_categories set name = 'X' where ${byId(i.categoryA)}`, writers),
  write("budget_categories", `delete from budget_categories`, none),
  read("budgets", members),
  write("budgets", `insert into budgets (grant_id, version_no) values ('${i.grantB}', 1)`, writers),
  write("budgets", `update budgets set version_no = 3 where ${byId(i.budgetDraft)}`, writers),
  write("budgets", `delete from budgets where ${byId(i.budgetDraft)}`, writers),
  write("budgets", `delete from budgets where ${byId(i.budgetApproved)}`, none),
  read("budget_lines", members),
  write("budget_lines", `insert into budget_lines (budget_id, grant_id, category_id, amount_cents) values ('${i.budgetDraft}', '${i.grantA}', '${i.categoryA2}', 1)`, writers),
  write("budget_lines", `update budget_lines set amount_cents = 2 where ${byId(i.budgetLine)}`, writers),
  write("budget_lines", `delete from budget_lines where ${byId(i.budgetLine)}`, writers),
  read("imports", members, byId(i.importBudget)),
  read("imports", payMembers, byId(i.importPayroll)),
  write("imports", `insert into imports (kind, grant_id) values ('budget', '${i.grantA}')`, writers),
  write("imports", `insert into imports (kind, sensitivity) values ('payroll', 'payroll')`, payWriters),
  write("imports", `update imports set sheet_name = 'x' where ${byId(i.importBudget)}`, writers),
  write("imports", `update imports set sheet_name = 'x' where ${byId(i.importPayroll)}`, payWriters),
  write("imports", `delete from imports where ${byId(i.importBudget)}`, writers),
  write("imports", `delete from imports where ${byId(i.importPayroll)}`, payWriters),
  read("import_rows", members, byId(i.importRow)),
  read("import_rows", payMembers, byId(i.importRowPayroll)),
  write("import_rows", `insert into import_rows (import_id, row_no) values ('${i.importBudget}', 2)`, writers),
  write("import_rows", `insert into import_rows (import_id, row_no) values ('${i.importPayroll}', 2)`, payWriters),
  write("import_rows", `update import_rows set message = 'x' where ${byId(i.importRow)}`, writers),
  write("import_rows", `update import_rows set message = 'x' where ${byId(i.importRowPayroll)}`, payWriters),
  write("import_rows", `delete from import_rows where ${byId(i.importRow)}`, writers),
  write("import_rows", `delete from import_rows where ${byId(i.importRowPayroll)}`, payWriters),
  read("receipts", members),
  write("receipts", `insert into receipts (vendor) values ('N')`, writers),
  write("receipts", `update receipts set vendor = 'X' where ${byId(i.receiptDraft)}`, writers),
  write("receipts", `delete from receipts where ${byId(i.receiptDraft)}`, writers),
  write("receipts", `delete from receipts where ${byId(i.receiptConfirmed)}`, none),
  read("receipt_allocations", members),
  write("receipt_allocations", `insert into receipt_allocations (receipt_id, grant_id, category_id, amount_cents) values ('${i.receiptDraft}', '${i.grantB}', '${i.categoryB}', 1)`, writers),
  write("receipt_allocations", `update receipt_allocations set amount_cents = 2 where ${byId(i.allocationDraft)}`, writers),
  write("receipt_allocations", `delete from receipt_allocations where ${byId(i.allocationDraft)}`, writers),

  read("employees", payMembers),
  write("employees", `insert into employees (external_ref, display_name) values ('N', 'N')`, payWriters),
  write("employees", `update employees set display_name = 'X'`, payWriters),
  write("employees", `delete from employees`, none),
  read("employee_splits", payMembers),
  write("employee_splits", `insert into employee_splits (employee_id, percent_bp) values ('${i.employeeSpare}', 10000)`, payWriters),
  write("employee_splits", `update employee_splits set percent_bp = 9000`, payWriters),
  write("employee_splits", `delete from employee_splits`, payWriters),
  read("payroll_runs", payMembers),
  write("payroll_runs", `insert into payroll_runs (period_start, period_end, pay_date, fingerprint) values ('2026-03-01', '2026-03-15', '2026-03-20', 'n')`, payWriters),
  write("payroll_runs", `update payroll_runs set pay_date = '2026-02-06' where ${byId(i.runDraft)}`, payWriters),
  write("payroll_runs", `delete from payroll_runs where ${byId(i.runDraft)}`, payWriters),
  write("payroll_runs", `delete from payroll_runs where ${byId(i.runPosted)}`, none),
  read("payroll_entries", payMembers),
  write("payroll_entries", `insert into payroll_entries (run_id, employee_id, cost_cents) values ('${i.runDraft}', '${i.employeeSpare}', 1)`, payWriters),
  write("payroll_entries", `update payroll_entries set cost_cents = 1 where ${byId(i.entryDraft)}`, payWriters),
  write("payroll_entries", `delete from payroll_entries where ${byId(i.entryDraft)}`, payWriters),
  read("payroll_allocations", payMembers),
  write("payroll_allocations", `insert into payroll_allocations (entry_id, percent_bp, amount_cents) values ('${i.entryDraft}', 5000, 5000)`, payWriters),
  write("payroll_allocations", `update payroll_allocations set amount_cents = 1 where ${byId(i.allocationPayroll)}`, payWriters),
  write("payroll_allocations", `delete from payroll_allocations where ${byId(i.allocationPayroll)}`, payWriters),

  read("warnings", members, byId(i.warning)),
  read("warnings", payMembers, byId(i.warningPayroll)),
  write("warnings", `insert into warnings (kind, message) values ('near_limit', 'n')`, writers),
  write("warnings", `insert into warnings (kind, message, sensitivity) values ('near_limit', 'n', 'payroll')`, payWriters),
  write("warnings", `update warnings set message = 'x' where ${byId(i.warning)}`, writers),
  write("warnings", `update warnings set message = 'x' where ${byId(i.warningPayroll)}`, payWriters),
  write("warnings", `delete from warnings`, none),

  read("category_balances", members),
  read("grant_balances", members),
  read("recent_activity", members),
];

describe.each(Object.keys(people) as Person[])("as %s", (person) => {
  it.each(rules)("$label", async ({ sql, who }) => {
    const outcome = await asUser(people[person], (client) => allowed(client, sql));
    expect(outcome).toBe(who.includes(person));
  });
});

it("covers every table", async () => {
  const tables = await asOwner((c) => c.query("select tablename from pg_tables where schemaname = 'public'"));
  const covered = new Set(rules.map((rule) => rule.label.split(" ")[0]));
  expect(tables.rows).toHaveLength(32);
  expect(tables.rows.map((row) => row.tablename).filter((name) => !covered.has(name))).toEqual([]);
});
