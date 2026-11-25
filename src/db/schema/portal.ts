import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  cents,
  day,
  deadlineOrigin,
  deadlineStatus,
  deadlineType,
  documentCategory,
  fileStatus,
  grantStatus,
  id,
  moment,
  sensitivity,
  timestamps,
} from "./common";
import { users } from "./identity";

export const organizationProfile = pgTable(
  "organization_profile",
  {
    id: integer("id").primaryKey().default(1),
    legalName: text("legal_name").notNull(),
    ein: text("ein"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
    fiscalYearStartDay: integer("fiscal_year_start_day").notNull().default(1),
    signerName: text("signer_name"),
    signerTitle: text("signer_title"),
    signerEmail: text("signer_email"),
    timezone: text("timezone").notNull().default("America/New_York"),
    ...timestamps(),
  },
  (t) => [
    check("organization_profile_singleton", sql`${t.id} = 1`),
    check("organization_profile_ein_format", sql`${t.ein} ~ '^[0-9]{2}-[0-9]{7}$'`),
    check("organization_profile_month", sql`${t.fiscalYearStartMonth} between 1 and 12`),
    check("organization_profile_day", sql`${t.fiscalYearStartDay} between 1 and 31`),
  ],
);

export const files = pgTable(
  "files",
  {
    id: id(),
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sha256: text("sha256"),
    status: fileStatus("status").notNull().default("pending"),
    sensitivity: sensitivity("sensitivity").notNull().default("general"),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    readyAt: moment("ready_at"),
    ...timestamps(),
  },
  (t) => [
    index("files_pending_idx").on(t.status, t.createdAt),
    check("files_size", sql`${t.sizeBytes} > 0 and ${t.sizeBytes} <= 15728640`),
    check("files_ready", sql`${t.status} <> 'ready' or ${t.readyAt} is not null`),
  ],
);

export const grants = pgTable(
  "grants",
  {
    id: id(),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),
    funderName: text("funder_name").notNull(),
    awardNumber: text("award_number"),
    awardCents: cents("award_cents").notNull(),
    awardedOn: day("awarded_on"),
    startsOn: day("starts_on").notNull(),
    endsOn: day("ends_on").notNull(),
    ownerId: uuid("owner_id").references(() => users.id),
    status: grantStatus("status").notNull().default("draft"),
    purpose: text("purpose"),
    termsText: text("terms_text"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    check("grants_award", sql`${t.awardCents} >= 0`),
    check("grants_period", sql`${t.endsOn} >= ${t.startsOn}`),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    grantId: uuid("grant_id").references(() => grants.id),
    title: text("title").notNull(),
    category: documentCategory("category").notNull(),
    expiresOn: day("expires_on"),
    reviewOn: day("review_on"),
    ownerId: uuid("owner_id").references(() => users.id),
    notes: text("notes"),
    archivedAt: moment("archived_at"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    index("documents_grant_idx").on(t.grantId),
    index("documents_expires_idx").on(t.expiresOn),
    index("documents_review_idx").on(t.reviewOn),
    uniqueIndex("documents_one_live_contract")
      .on(t.grantId)
      .where(sql`${t.category} = 'executed_contract' and ${t.archivedAt} is null`),
    check("documents_contract_has_grant", sql`${t.category} <> 'executed_contract' or ${t.grantId} is not null`),
  ],
);

export const documentVersions = pgTable(
  "document_versions",
  {
    id: id(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id),
    versionNo: integer("version_no").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .unique()
      .references(() => files.id),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (t) => [
    unique("document_versions_number_key").on(t.documentId, t.versionNo),
    check("document_versions_number", sql`${t.versionNo} > 0`),
  ],
);

export const grantContacts = pgTable(
  "grant_contacts",
  {
    id: id(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => grants.id),
    name: text("name").notNull(),
    title: text("title"),
    agency: text("agency"),
    email: text("email"),
    phone: text("phone"),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    index("grant_contacts_grant_idx").on(t.grantId),
    uniqueIndex("grant_contacts_one_primary")
      .on(t.grantId)
      .where(sql`${t.isPrimary}`),
  ],
);

export const grantLinks = pgTable(
  "grant_links",
  {
    id: id(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => grants.id),
    label: text("label").notNull(),
    url: text("url").notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    index("grant_links_grant_idx").on(t.grantId),
    check("grant_links_https", sql`${t.url} ~ '^https://[^[:space:]]+$'`),
  ],
);

export const deadlines = pgTable(
  "deadlines",
  {
    id: id(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => grants.id),
    type: deadlineType("type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    dueOn: day("due_on").notNull(),
    ownerId: uuid("owner_id").references(() => users.id),
    status: deadlineStatus("status").notNull().default("open"),
    completedAt: moment("completed_at"),
    completedBy: uuid("completed_by").references(() => users.id),
    reminderDays: integer("reminder_days").notNull().default(7),
    origin: deadlineOrigin("origin").notNull().default("manual"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    index("deadlines_grant_idx").on(t.grantId),
    index("deadlines_due_idx").on(t.status, t.dueOn),
    check("deadlines_reminder", sql`${t.reminderDays} between 1 and 90`),
    check("deadlines_completed", sql`(${t.status} = 'completed') = (${t.completedAt} is not null)`),
  ],
);
