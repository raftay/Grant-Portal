import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import {
  actorKind,
  aiKind,
  aiStatus,
  day,
  emailStatus,
  id,
  moment,
  notificationKind,
  proposalStatus,
  sensitivity,
  timestamps,
} from "./common";
import { users } from "./identity";
import { deadlines, documents, files, grants } from "./portal";

export const emailMessages = pgTable(
  "email_messages",
  {
    id: id(),
    kind: text("kind").notNull(),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    bodyHtml: text("body_html"),
    status: emailStatus("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    providerId: text("provider_id"),
    error: text("error"),
    sentAt: moment("sent_at"),
    ...timestamps(),
  },
  (t) => [index("email_messages_created_idx").on(t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    kind: notificationKind("kind").notNull(),
    recipientId: uuid("recipient_id")
      .notNull()
      .references(() => users.id),
    documentId: uuid("document_id").references(() => documents.id),
    deadlineId: uuid("deadline_id").references(() => deadlines.id),
    dueOn: day("due_on").notNull(),
    milestone: text("milestone").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    emailMessageId: uuid("email_message_id")
      .unique()
      .references(() => emailMessages.id),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notifications_recipient_idx").on(t.recipientId),
    check(
      "notifications_one_subject",
      sql`(${t.kind} = 'deadline' and ${t.deadlineId} is not null and ${t.documentId} is null)
        or (${t.kind} <> 'deadline' and ${t.documentId} is not null and ${t.deadlineId} is null)`,
    ),
    check("notifications_milestone", sql`${t.milestone} in ('30d', 'reminder', 'overdue')`),
  ],
);

export const aiExtractions = pgTable(
  "ai_extractions",
  {
    id: id(),
    kind: aiKind("kind").notNull(),
    fileId: uuid("file_id").references(() => files.id),
    grantId: uuid("grant_id").references(() => grants.id),
    status: aiStatus("status").notNull().default("pending"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    error: text("error"),
    sensitivity: sensitivity("sensitivity").notNull().default("general"),
    requestedBy: uuid("requested_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    index("ai_extractions_file_idx").on(t.fileId),
    index("ai_extractions_usage_idx").on(t.requestedBy, t.createdAt),
    check("ai_extractions_payroll", sql`${t.kind} <> 'payroll_columns' or ${t.sensitivity} = 'payroll'`),
  ],
);

export const aiProposals = pgTable(
  "ai_proposals",
  {
    id: id(),
    extractionId: uuid("extraction_id")
      .notNull()
      .references(() => aiExtractions.id),
    groupNo: integer("group_no").notNull().default(0),
    targetEntity: text("target_entity").notNull(),
    targetField: text("target_field").notNull(),
    proposedValue: jsonb("proposed_value").notNull(),
    evidence: text("evidence"),
    pageNo: integer("page_no"),
    status: proposalStatus("status").notNull().default("pending"),
    finalValue: jsonb("final_value"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: moment("reviewed_at"),
    appliedEntityId: uuid("applied_entity_id"),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("ai_proposals_extraction_idx").on(t.extractionId),
    check(
      "ai_proposals_reviewed",
      sql`(${t.status} = 'pending') = (${t.reviewedBy} is null) and (${t.reviewedBy} is null) = (${t.reviewedAt} is null)`,
    ),
    check("ai_proposals_applied", sql`${t.appliedEntityId} is null or ${t.status} in ('accepted', 'edited')`),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: moment("occurred_at").notNull().defaultNow(),
    actorId: uuid("actor_id").references(() => users.id),
    actorKind: actorKind("actor_kind").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    grantId: uuid("grant_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    requestId: text("request_id"),
    sensitivity: sensitivity("sensitivity").notNull().default("general"),
  },
  (t) => [
    index("audit_log_occurred_idx").on(t.occurredAt),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_grant_idx").on(t.grantId),
  ],
);
