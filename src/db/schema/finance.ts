import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { aiExtractions } from "./activity";
import {
  budgetCategoryKind,
  budgetStatus,
  cents,
  day,
  id,
  importKind,
  importRowStatus,
  importStatus,
  moment,
  payrollRunStatus,
  receiptStatus,
  sensitivity,
  timestamps,
  warningKind,
  warningStatus,
} from "./common";
import { users } from "./identity";
import { files, grants } from "./portal";

export const budgetCategories = pgTable(
  "budget_categories",
  {
    id: id(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => grants.id),
    name: text("name").notNull(),
    code: text("code"),
    kind: budgetCategoryKind("kind").notNull().default("other"),
    isSalary: boolean("is_salary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    archivedAt: moment("archived_at"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    unique("budget_categories_id_grant_key").on(t.id, t.grantId),
    uniqueIndex("budget_categories_name_key").on(t.grantId, sql`lower(${t.name})`),
  ],
);

export const imports = pgTable(
  "imports",
  {
    id: id(),
    kind: importKind("kind").notNull(),
    fileId: uuid("file_id").references(() => files.id),
    grantId: uuid("grant_id").references(() => grants.id),
    status: importStatus("status").notNull().default("uploaded"),
    sheetName: text("sheet_name"),
    headerRow: integer("header_row"),
    columnMapping: jsonb("column_mapping"),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: moment("confirmed_at"),
    sensitivity: sensitivity("sensitivity").notNull().default("general"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    index("imports_grant_idx").on(t.grantId),
    check(
      "imports_payroll",
      sql`${t.kind} <> 'payroll' or (${t.fileId} is null and ${t.grantId} is null and ${t.sensitivity} = 'payroll')`,
    ),
    check("imports_budget", sql`${t.kind} <> 'budget' or ${t.grantId} is not null`),
    check(
      "imports_confirmed",
      sql`${t.status} <> 'confirmed' or (${t.confirmedBy} is not null and ${t.confirmedAt} is not null)`,
    ),
  ],
);

export const importRows = pgTable(
  "import_rows",
  {
    id: id(),
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    rowNo: integer("row_no").notNull(),
    raw: jsonb("raw"),
    parsed: jsonb("parsed"),
    status: importRowStatus("status").notNull().default("included"),
    categoryId: uuid("category_id").references(() => budgetCategories.id),
    message: text("message"),
  },
  (t) => [unique("import_rows_number_key").on(t.importId, t.rowNo)],
);

export const budgets = pgTable(
  "budgets",
  {
    id: id(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => grants.id),
    versionNo: integer("version_no").notNull(),
    status: budgetStatus("status").notNull().default("draft"),
    importId: uuid("import_id")
      .unique()
      .references(() => imports.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: moment("approved_at"),
    awardMismatchAckBy: uuid("award_mismatch_ack_by").references(() => users.id),
    awardMismatchAckAt: moment("award_mismatch_ack_at"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    unique("budgets_id_grant_key").on(t.id, t.grantId),
    unique("budgets_version_key").on(t.grantId, t.versionNo),
    uniqueIndex("budgets_one_approved")
      .on(t.grantId)
      .where(sql`${t.status} = 'approved'`),
    check(
      "budgets_approved",
      sql`${t.status} = 'draft' or (${t.approvedBy} is not null and ${t.approvedAt} is not null)`,
    ),
  ],
);

export const budgetLines = pgTable(
  "budget_lines",
  {
    id: id(),
    budgetId: uuid("budget_id").notNull(),
    grantId: uuid("grant_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    description: text("description"),
    amountCents: cents("amount_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("budget_lines_category_idx").on(t.categoryId),
    foreignKey({ columns: [t.budgetId, t.grantId], foreignColumns: [budgets.id, budgets.grantId] }).onDelete("cascade"),
    foreignKey({
      columns: [t.categoryId, t.grantId],
      foreignColumns: [budgetCategories.id, budgetCategories.grantId],
    }),
    check("budget_lines_amount", sql`${t.amountCents} >= 0`),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    id: id(),
    fileId: uuid("file_id")
      .unique()
      .references(() => files.id),
    vendor: text("vendor"),
    purchasedOn: day("purchased_on"),
    totalCents: cents("total_cents"),
    description: text("description"),
    status: receiptStatus("status").notNull().default("draft"),
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: moment("confirmed_at"),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidedAt: moment("voided_at"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    index("receipts_duplicate_idx").on(t.totalCents, t.purchasedOn),
    check("receipts_total", sql`${t.totalCents} > 0`),
    check(
      "receipts_confirmed",
      sql`${t.status} = 'draft' or (${t.totalCents} is not null and ${t.confirmedBy} is not null and ${t.confirmedAt} is not null)`,
    ),
    check("receipts_voided", sql`${t.status} <> 'voided' or (${t.voidedBy} is not null and ${t.voidedAt} is not null)`),
  ],
);

export const receiptAllocations = pgTable(
  "receipt_allocations",
  {
    id: id(),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => receipts.id, { onDelete: "cascade" }),
    grantId: uuid("grant_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    amountCents: cents("amount_cents").notNull(),
  },
  (t) => [
    unique("receipt_allocations_category_key").on(t.receiptId, t.categoryId),
    index("receipt_allocations_category_idx").on(t.categoryId),
    foreignKey({
      columns: [t.categoryId, t.grantId],
      foreignColumns: [budgetCategories.id, budgetCategories.grantId],
    }),
    check("receipt_allocations_amount", sql`${t.amountCents} > 0`),
  ],
);

export const employees = pgTable("employees", {
  id: id(),
  externalRef: text("external_ref").notNull().unique(),
  displayName: text("display_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  ...timestamps(),
});

export const employeeSplits = pgTable(
  "employee_splits",
  {
    id: id(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    grantId: uuid("grant_id"),
    categoryId: uuid("category_id"),
    percentBp: integer("percent_bp").notNull(),
  },
  (t) => [
    unique("employee_splits_target_key").on(t.employeeId, t.categoryId).nullsNotDistinct(),
    foreignKey({
      columns: [t.categoryId, t.grantId],
      foreignColumns: [budgetCategories.id, budgetCategories.grantId],
    }),
    check("employee_splits_target", sql`(${t.grantId} is null) = (${t.categoryId} is null)`),
    check("employee_splits_percent", sql`${t.percentBp} between 1 and 10000`),
  ],
);

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: id(),
    importId: uuid("import_id")
      .unique()
      .references(() => imports.id),
    periodStart: day("period_start").notNull(),
    periodEnd: day("period_end").notNull(),
    payDate: day("pay_date").notNull(),
    fingerprint: text("fingerprint").notNull(),
    status: payrollRunStatus("status").notNull().default("draft"),
    postedBy: uuid("posted_by").references(() => users.id),
    postedAt: moment("posted_at"),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidedAt: moment("voided_at"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex("payroll_runs_fingerprint_key")
      .on(t.fingerprint)
      .where(sql`${t.status} <> 'voided'`),
    check("payroll_runs_period", sql`${t.periodEnd} >= ${t.periodStart}`),
    check(
      "payroll_runs_posted",
      sql`${t.status} = 'draft' or (${t.postedBy} is not null and ${t.postedAt} is not null)`,
    ),
    check(
      "payroll_runs_voided",
      sql`${t.status} <> 'voided' or (${t.voidedBy} is not null and ${t.voidedAt} is not null)`,
    ),
  ],
);

export const payrollEntries = pgTable(
  "payroll_entries",
  {
    id: id(),
    runId: uuid("run_id")
      .notNull()
      .references(() => payrollRuns.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    costCents: cents("cost_cents").notNull(),
  },
  (t) => [
    unique("payroll_entries_employee_key").on(t.runId, t.employeeId),
    check("payroll_entries_cost", sql`${t.costCents} >= 0`),
  ],
);

export const payrollAllocations = pgTable(
  "payroll_allocations",
  {
    id: id(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => payrollEntries.id, { onDelete: "cascade" }),
    grantId: uuid("grant_id"),
    categoryId: uuid("category_id"),
    percentBp: integer("percent_bp").notNull(),
    amountCents: cents("amount_cents").notNull(),
  },
  (t) => [
    unique("payroll_allocations_target_key").on(t.entryId, t.categoryId).nullsNotDistinct(),
    index("payroll_allocations_category_idx").on(t.categoryId),
    foreignKey({
      columns: [t.categoryId, t.grantId],
      foreignColumns: [budgetCategories.id, budgetCategories.grantId],
    }),
    check("payroll_allocations_target", sql`(${t.grantId} is null) = (${t.categoryId} is null)`),
    check("payroll_allocations_percent", sql`${t.percentBp} between 1 and 10000`),
    check("payroll_allocations_amount", sql`${t.amountCents} >= 0`),
  ],
);

export const warnings = pgTable(
  "warnings",
  {
    id: id(),
    kind: warningKind("kind").notNull(),
    grantId: uuid("grant_id").references(() => grants.id),
    categoryId: uuid("category_id").references(() => budgetCategories.id),
    receiptId: uuid("receipt_id").references(() => receipts.id),
    payrollRunId: uuid("payroll_run_id").references(() => payrollRuns.id),
    message: text("message").notNull(),
    extractionId: uuid("extraction_id").references(() => aiExtractions.id),
    status: warningStatus("status").notNull().default("open"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: moment("reviewed_at"),
    sensitivity: sensitivity("sensitivity").notNull().default("general"),
    ...timestamps(),
  },
  (t) => [
    index("warnings_grant_idx").on(t.grantId, t.status),
    check("warnings_payroll", sql`${t.payrollRunId} is null or ${t.sensitivity} = 'payroll'`),
    check("warnings_reviewed", sql`${t.status} = 'open' or (${t.reviewedBy} is not null and ${t.reviewedAt} is not null)`),
  ],
);
