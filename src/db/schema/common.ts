import { bigint, date, pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "staff", "viewer"]);
export const userStatus = pgEnum("user_status", ["invited", "active", "deactivated"]);
export const tokenPurpose = pgEnum("token_purpose", ["invite", "password_reset"]);
export const sensitivity = pgEnum("sensitivity", ["general", "payroll"]);
export const fileStatus = pgEnum("file_status", ["pending", "ready", "failed"]);
export const documentCategory = pgEnum("document_category", [
  "w9",
  "insurance",
  "policy",
  "pnl",
  "executed_contract",
  "award_letter",
  "report",
  "other",
]);
export const grantStatus = pgEnum("grant_status", ["draft", "active", "closed"]);
export const deadlineType = pgEnum("deadline_type", ["report", "deliverable", "contract_expiry"]);
export const deadlineStatus = pgEnum("deadline_status", ["open", "in_progress", "completed", "waived"]);
export const deadlineOrigin = pgEnum("deadline_origin", ["manual", "ai_contract"]);
export const emailStatus = pgEnum("email_status", ["queued", "sent", "failed", "suppressed"]);
export const notificationKind = pgEnum("notification_kind", ["doc_expiry", "doc_review", "deadline"]);
export const aiKind = pgEnum("ai_kind", [
  "document_dates",
  "contract_terms",
  "budget_mapping",
  "receipt",
  "payroll_columns",
  "receipt_check",
]);
export const aiStatus = pgEnum("ai_status", ["pending", "proposed", "reviewed", "failed"]);
export const proposalStatus = pgEnum("proposal_status", ["pending", "accepted", "edited", "rejected"]);
export const actorKind = pgEnum("actor_kind", ["user", "system"]);
export const budgetStatus = pgEnum("budget_status", ["draft", "approved", "superseded"]);
export const budgetCategoryKind = pgEnum("budget_category_kind", [
  "personnel",
  "fringe",
  "travel",
  "equipment",
  "supplies",
  "contractual",
  "other",
  "indirect",
]);
export const importKind = pgEnum("import_kind", ["budget", "payroll"]);
export const importStatus = pgEnum("import_status", ["uploaded", "previewed", "confirmed", "discarded", "failed"]);
export const importRowStatus = pgEnum("import_row_status", ["included", "excluded", "error"]);
export const receiptStatus = pgEnum("receipt_status", ["draft", "confirmed", "voided"]);
export const payrollRunStatus = pgEnum("payroll_run_status", ["draft", "posted", "voided"]);
export const warningKind = pgEnum("warning_kind", ["near_limit", "unallowable", "possible_duplicate"]);
export const warningStatus = pgEnum("warning_status", ["open", "acknowledged", "dismissed"]);

export const id = () => uuid("id").primaryKey().defaultRandom();
export const cents = (name: string) => bigint(name, { mode: "number" });
export const day = (name: string) => date(name, { mode: "string" });
export const moment = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const timestamps = () => ({
  createdAt: moment("created_at").notNull().defaultNow(),
  updatedAt: moment("updated_at").notNull().defaultNow(),
});
