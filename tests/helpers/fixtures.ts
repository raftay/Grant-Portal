import type { Client } from "pg";

const make = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const ids = {
  adminPay: make(1),
  admin: make(2),
  staff: make(3),
  staffPay: make(4),
  viewer: make(5),
  viewerPay: make(6),
  deactivated: make(7),
  grantA: make(20),
  grantB: make(21),
  fileGeneral: make(30),
  filePayroll: make(31),
  fileSpare: make(32),
  filePending: make(33),
  document: make(40),
  version: make(41),
  contact: make(42),
  link: make(43),
  deadline: make(44),
  email: make(50),
  notification: make(51),
  notificationAdmin: make(52),
  extraction: make(53),
  extractionPayroll: make(54),
  proposal: make(55),
  proposalPayroll: make(56),
  token: make(57),
  categoryA: make(60),
  categoryA2: make(61),
  categoryB: make(62),
  importBudget: make(63),
  importPayroll: make(64),
  importRow: make(65),
  importRowPayroll: make(66),
  budgetApproved: make(67),
  budgetDraft: make(68),
  budgetLine: make(69),
  receiptConfirmed: make(70),
  receiptDraft: make(71),
  allocationDraft: make(72),
  employee: make(80),
  employeeSpare: make(81),
  split: make(82),
  runPosted: make(83),
  runDraft: make(84),
  entryDraft: make(85),
  allocationPayroll: make(86),
  entryPosted: make(87),
  warning: make(90),
  warningPayroll: make(91),
} as const;

export async function loadFixtures(db: Client): Promise<void> {
  const i = ids;
  await db.query("begin");
  await db.query("alter table users disable trigger b_guard");
  await db.query(`
    insert into users (id, name, email, role, status, can_view_payroll) values
      ('${i.adminPay}', 'Ada', 'ada@example.org', 'admin', 'active', true),
      ('${i.admin}', 'Abe', 'abe@example.org', 'admin', 'active', false),
      ('${i.staff}', 'Sam', 'sam@example.org', 'staff', 'active', false),
      ('${i.staffPay}', 'Sky', 'sky@example.org', 'staff', 'active', true),
      ('${i.viewer}', 'Val', 'val@example.org', 'viewer', 'active', false),
      ('${i.viewerPay}', 'Vic', 'vic@example.org', 'viewer', 'active', true),
      ('${i.deactivated}', 'Dee', 'dee@example.org', 'admin', 'deactivated', true);
  `);
  await db.query("alter table users enable trigger b_guard");
  await db.query(`
    insert into user_credentials (user_id, password_hash) values ('${i.adminPay}', 'secret-hash');
    insert into accounts (user_id, type, provider, provider_account_id) values ('${i.adminPay}', 'email', 'resend', 'x');
    insert into verification_tokens (identifier, token, expires) values ('ada@example.org', 'tok', now());
    insert into auth_tokens (id, user_id, purpose, token_hash, expires_at) values ('${i.token}', '${i.adminPay}', 'invite', 'hash', now());
    insert into login_attempts (email_hash, ip_hash, succeeded) values ('e', 'i', true);
    insert into organization_profile (legal_name, ein) values ('Example Org', '12-3456789');
    insert into files (id, storage_key, original_name, mime_type, size_bytes, status, sensitivity, ready_at) values
      ('${i.fileGeneral}', 'k1', 'a.pdf', 'application/pdf', 10, 'ready', 'general', now()),
      ('${i.filePayroll}', 'k2', 'b.pdf', 'application/pdf', 10, 'ready', 'payroll', now()),
      ('${i.fileSpare}', 'k3', 'c.pdf', 'application/pdf', 10, 'ready', 'general', now()),
      ('${i.filePending}', 'k4', 'd.pdf', 'application/pdf', 10, 'pending', 'general', null);
    insert into grants (id, name, code, funder_name, award_cents, starts_on, ends_on, status) values
      ('${i.grantA}', 'Alpha', 'A', 'Funder', 100000, '2026-01-01', '2026-12-31', 'active'),
      ('${i.grantB}', 'Beta', 'B', 'Funder', 50000, '2026-01-01', '2026-12-31', 'active');
    insert into documents (id, title, category, owner_id) values ('${i.document}', 'W-9', 'w9', '${i.staff}');
    insert into document_versions (id, document_id, version_no, file_id) values ('${i.version}', '${i.document}', 1, '${i.fileGeneral}');
    insert into grant_contacts (id, grant_id, name) values ('${i.contact}', '${i.grantA}', 'Officer');
    insert into grant_links (id, grant_id, label, url) values ('${i.link}', '${i.grantA}', 'Portal', 'https://example.org');
    insert into deadlines (id, grant_id, type, title, due_on) values ('${i.deadline}', '${i.grantA}', 'report', 'Q1', '2026-04-01');
    insert into email_messages (id, kind, to_email, subject) values ('${i.email}', 'alert', 'sam@example.org', 'Hi');
    insert into notifications (id, kind, recipient_id, document_id, due_on, milestone, dedupe_key) values
      ('${i.notification}', 'doc_expiry', '${i.staff}', '${i.document}', '2026-04-01', '30d', 'k1'),
      ('${i.notificationAdmin}', 'doc_expiry', '${i.admin}', '${i.document}', '2026-04-01', 'overdue', 'k2');
    insert into ai_extractions (id, kind, model, prompt_version, sensitivity) values
      ('${i.extraction}', 'document_dates', 'm', 'v1', 'general'),
      ('${i.extractionPayroll}', 'payroll_columns', 'm', 'v1', 'payroll');
    insert into ai_proposals (id, extraction_id, target_entity, target_field, proposed_value) values
      ('${i.proposal}', '${i.extraction}', 'documents', 'expires_on', '"2026-04-01"'),
      ('${i.proposalPayroll}', '${i.extractionPayroll}', 'payroll', 'cost', '1');
    insert into budget_categories (id, grant_id, name, is_salary) values
      ('${i.categoryA}', '${i.grantA}', 'Salary', true),
      ('${i.categoryA2}', '${i.grantA}', 'Supplies', false),
      ('${i.categoryB}', '${i.grantB}', 'Travel', false);
    insert into imports (id, kind, grant_id, sensitivity) values ('${i.importBudget}', 'budget', '${i.grantA}', 'general');
    insert into imports (id, kind, sensitivity) values ('${i.importPayroll}', 'payroll', 'payroll');
    insert into import_rows (id, import_id, row_no, parsed) values
      ('${i.importRow}', '${i.importBudget}', 1, '{}'),
      ('${i.importRowPayroll}', '${i.importPayroll}', 1, '{}');
    insert into budgets (id, grant_id, version_no) values
      ('${i.budgetApproved}', '${i.grantA}', 1), ('${i.budgetDraft}', '${i.grantA}', 2);
    insert into budget_lines (budget_id, grant_id, category_id, amount_cents) values
      ('${i.budgetApproved}', '${i.grantA}', '${i.categoryA}', 70000),
      ('${i.budgetApproved}', '${i.grantA}', '${i.categoryA2}', 30000);
    insert into budget_lines (id, budget_id, grant_id, category_id, amount_cents) values
      ('${i.budgetLine}', '${i.budgetDraft}', '${i.grantA}', '${i.categoryA}', 1);
    update budgets set status = 'approved', approved_by = '${i.admin}', approved_at = now() where id = '${i.budgetApproved}';
    insert into receipts (id, total_cents) values ('${i.receiptConfirmed}', 1000), ('${i.receiptDraft}', 500);
    insert into receipt_allocations (receipt_id, grant_id, category_id, amount_cents) values
      ('${i.receiptConfirmed}', '${i.grantA}', '${i.categoryA2}', 1000);
    insert into receipt_allocations (id, receipt_id, grant_id, category_id, amount_cents) values
      ('${i.allocationDraft}', '${i.receiptDraft}', '${i.grantA}', '${i.categoryA2}', 500);
    update receipts set status = 'confirmed', confirmed_by = '${i.staff}', confirmed_at = now() where id = '${i.receiptConfirmed}';
    insert into employees (id, external_ref, display_name) values ('${i.employee}', 'E1', 'Pat'), ('${i.employeeSpare}', 'E2', 'Kim');
    insert into employee_splits (id, employee_id, percent_bp) values ('${i.split}', '${i.employee}', 10000);
    insert into payroll_runs (id, period_start, period_end, pay_date, fingerprint) values
      ('${i.runPosted}', '2026-01-01', '2026-01-15', '2026-01-20', 'f1'),
      ('${i.runDraft}', '2026-01-16', '2026-01-31', '2026-02-05', 'f2');
    insert into payroll_entries (id, run_id, employee_id, cost_cents) values
      ('${i.entryPosted}', '${i.runPosted}', '${i.employee}', 10001),
      ('${i.entryDraft}', '${i.runDraft}', '${i.employee}', 10001);
    insert into payroll_allocations (entry_id, grant_id, category_id, percent_bp, amount_cents) values
      ('${i.entryPosted}', '${i.grantA}', '${i.categoryA}', 5000, 5001),
      ('${i.entryPosted}', null, null, 5000, 5000);
    insert into payroll_allocations (id, entry_id, grant_id, category_id, percent_bp, amount_cents) values
      ('${i.allocationPayroll}', '${i.entryDraft}', '${i.grantA}', '${i.categoryA}', 5000, 5001);
    update payroll_runs set status = 'posted', posted_by = '${i.staffPay}', posted_at = now() where id = '${i.runPosted}';
    insert into warnings (id, kind, message, sensitivity) values
      ('${i.warning}', 'near_limit', 'm', 'general'), ('${i.warningPayroll}', 'near_limit', 'm', 'payroll');
  `);
  await db.query("commit");
}
