CREATE TYPE "public"."actor_kind" AS ENUM('user', 'system');
CREATE TYPE "public"."ai_kind" AS ENUM('document_dates', 'contract_terms', 'budget_mapping', 'receipt', 'payroll_columns', 'receipt_check');
CREATE TYPE "public"."ai_status" AS ENUM('pending', 'proposed', 'reviewed', 'failed');
CREATE TYPE "public"."budget_category_kind" AS ENUM('personnel', 'fringe', 'travel', 'equipment', 'supplies', 'contractual', 'other', 'indirect');
CREATE TYPE "public"."budget_status" AS ENUM('draft', 'approved', 'superseded');
CREATE TYPE "public"."deadline_origin" AS ENUM('manual', 'ai_contract');
CREATE TYPE "public"."deadline_status" AS ENUM('open', 'in_progress', 'completed', 'waived');
CREATE TYPE "public"."deadline_type" AS ENUM('report', 'deliverable', 'contract_expiry');
CREATE TYPE "public"."document_category" AS ENUM('w9', 'insurance', 'policy', 'pnl', 'executed_contract', 'award_letter', 'report', 'other');
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'failed', 'suppressed');
CREATE TYPE "public"."file_status" AS ENUM('pending', 'ready', 'failed');
CREATE TYPE "public"."grant_status" AS ENUM('draft', 'active', 'closed');
CREATE TYPE "public"."import_kind" AS ENUM('budget', 'payroll');
CREATE TYPE "public"."import_row_status" AS ENUM('included', 'excluded', 'error');
CREATE TYPE "public"."import_status" AS ENUM('uploaded', 'previewed', 'confirmed', 'discarded', 'failed');
CREATE TYPE "public"."notification_kind" AS ENUM('doc_expiry', 'doc_review', 'deadline');
CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'posted', 'voided');
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'accepted', 'edited', 'rejected');
CREATE TYPE "public"."receipt_status" AS ENUM('draft', 'confirmed', 'voided');
CREATE TYPE "public"."sensitivity" AS ENUM('general', 'payroll');
CREATE TYPE "public"."token_purpose" AS ENUM('invite', 'password_reset');
CREATE TYPE "public"."user_role" AS ENUM('admin', 'staff', 'viewer');
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'deactivated');
CREATE TYPE "public"."warning_kind" AS ENUM('near_limit', 'unallowable', 'possible_duplicate');
CREATE TYPE "public"."warning_status" AS ENUM('open', 'acknowledged', 'dismissed');
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);

CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" "token_purpose" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE "login_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"email_hash" text NOT NULL,
	"ip_hash" text NOT NULL,
	"succeeded" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"can_view_payroll" boolean DEFAULT false NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);

CREATE TABLE "deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"type" "deadline_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_on" date NOT NULL,
	"owner_id" uuid,
	"status" "deadline_status" DEFAULT 'open' NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"origin" "deadline_origin" DEFAULT 'manual' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deadlines_completed" CHECK (("deadlines"."status" = 'completed') = ("deadlines"."completed_at" is not null))
);

CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"file_id" uuid NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_versions_file_id_unique" UNIQUE("file_id"),
	CONSTRAINT "document_versions_number_key" UNIQUE("document_id","version_no"),
	CONSTRAINT "document_versions_number" CHECK ("document_versions"."version_no" > 0)
);

CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid,
	"title" text NOT NULL,
	"category" "document_category" NOT NULL,
	"expires_on" date,
	"review_on" date,
	"owner_id" uuid,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_contract_has_grant" CHECK ("documents"."category" <> 'executed_contract' or "documents"."grant_id" is not null)
);

CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text,
	"status" "file_status" DEFAULT 'pending' NOT NULL,
	"sensitivity" "sensitivity" DEFAULT 'general' NOT NULL,
	"uploaded_by" uuid,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "files_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "files_size" CHECK ("files"."size_bytes" > 0 and "files"."size_bytes" <= 15728640),
	CONSTRAINT "files_ready" CHECK ("files"."status" <> 'ready' or "files"."ready_at" is not null)
);

CREATE TABLE "grant_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"agency" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "grant_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grant_links_https" CHECK ("grant_links"."url" ~ '^https://[^[:space:]]+$')
);

CREATE TABLE "grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"funder_name" text NOT NULL,
	"award_number" text,
	"award_cents" bigint NOT NULL,
	"awarded_on" date,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"owner_id" uuid,
	"status" "grant_status" DEFAULT 'draft' NOT NULL,
	"terms_text" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "grants_code_unique" UNIQUE("code"),
	CONSTRAINT "grants_award" CHECK ("grants"."award_cents" >= 0),
	CONSTRAINT "grants_period" CHECK ("grants"."ends_on" >= "grants"."starts_on")
);

CREATE TABLE "organization_profile" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"legal_name" text NOT NULL,
	"ein" text,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"fiscal_year_start_day" integer DEFAULT 1 NOT NULL,
	"signer_name" text,
	"signer_title" text,
	"signer_email" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_profile_singleton" CHECK ("organization_profile"."id" = 1),
	CONSTRAINT "organization_profile_ein_format" CHECK ("organization_profile"."ein" ~ '^[0-9]{2}-[0-9]{7}$'),
	CONSTRAINT "organization_profile_month" CHECK ("organization_profile"."fiscal_year_start_month" between 1 and 12),
	CONSTRAINT "organization_profile_day" CHECK ("organization_profile"."fiscal_year_start_day" between 1 and 31)
);

CREATE TABLE "ai_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ai_kind" NOT NULL,
	"file_id" uuid,
	"grant_id" uuid,
	"status" "ai_status" DEFAULT 'pending' NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"error" text,
	"sensitivity" "sensitivity" DEFAULT 'general' NOT NULL,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_extractions_payroll" CHECK ("ai_extractions"."kind" <> 'payroll_columns' or "ai_extractions"."sensitivity" = 'payroll')
);

CREATE TABLE "ai_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"extraction_id" uuid NOT NULL,
	"group_no" integer DEFAULT 0 NOT NULL,
	"target_entity" text NOT NULL,
	"target_field" text NOT NULL,
	"proposed_value" jsonb NOT NULL,
	"evidence" text,
	"page_no" integer,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"final_value" jsonb,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"applied_entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_proposals_reviewed" CHECK (("ai_proposals"."status" = 'pending') = ("ai_proposals"."reviewed_by" is null) and ("ai_proposals"."reviewed_by" is null) = ("ai_proposals"."reviewed_at" is null)),
	CONSTRAINT "ai_proposals_applied" CHECK ("ai_proposals"."applied_entity_id" is null or "ai_proposals"."status" in ('accepted', 'edited'))
);

CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_kind" "actor_kind" NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"grant_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"sensitivity" "sensitivity" DEFAULT 'general' NOT NULL
);

CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider_id" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"recipient_id" uuid NOT NULL,
	"document_id" uuid,
	"deadline_id" uuid,
	"due_on" date NOT NULL,
	"milestone" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"email_message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "notifications_email_message_id_unique" UNIQUE("email_message_id"),
	CONSTRAINT "notifications_one_subject" CHECK (("notifications"."kind" = 'deadline' and "notifications"."deadline_id" is not null and "notifications"."document_id" is null)
        or ("notifications"."kind" <> 'deadline' and "notifications"."document_id" is not null and "notifications"."deadline_id" is null)),
	CONSTRAINT "notifications_milestone" CHECK ("notifications"."milestone" in ('30d', '14d', '7d', '1d', 'overdue'))
);

CREATE TABLE "budget_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"kind" "budget_category_kind" DEFAULT 'other' NOT NULL,
	"is_salary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_categories_id_grant_key" UNIQUE("id","grant_id")
);

CREATE TABLE "budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"grant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"description" text,
	"amount_cents" bigint NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "budget_lines_amount" CHECK ("budget_lines"."amount_cents" >= 0)
);

CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grant_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"status" "budget_status" DEFAULT 'draft' NOT NULL,
	"import_id" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"award_mismatch_ack_by" uuid,
	"award_mismatch_ack_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_import_id_unique" UNIQUE("import_id"),
	CONSTRAINT "budgets_id_grant_key" UNIQUE("id","grant_id"),
	CONSTRAINT "budgets_version_key" UNIQUE("grant_id","version_no"),
	CONSTRAINT "budgets_approved" CHECK ("budgets"."status" = 'draft' or ("budgets"."approved_by" is not null and "budgets"."approved_at" is not null))
);

CREATE TABLE "employee_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"grant_id" uuid,
	"category_id" uuid,
	"percent_bp" integer NOT NULL,
	CONSTRAINT "employee_splits_target_key" UNIQUE NULLS NOT DISTINCT("employee_id","category_id"),
	CONSTRAINT "employee_splits_target" CHECK (("employee_splits"."grant_id" is null) = ("employee_splits"."category_id" is null)),
	CONSTRAINT "employee_splits_percent" CHECK ("employee_splits"."percent_bp" between 1 and 10000)
);

CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_ref" text NOT NULL,
	"display_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_external_ref_unique" UNIQUE("external_ref")
);

CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"row_no" integer NOT NULL,
	"raw" jsonb,
	"parsed" jsonb,
	"status" "import_row_status" DEFAULT 'included' NOT NULL,
	"category_id" uuid,
	"message" text,
	CONSTRAINT "import_rows_number_key" UNIQUE("import_id","row_no")
);

CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "import_kind" NOT NULL,
	"file_id" uuid,
	"grant_id" uuid,
	"status" "import_status" DEFAULT 'uploaded' NOT NULL,
	"sheet_name" text,
	"header_row" integer,
	"column_mapping" jsonb,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"sensitivity" "sensitivity" DEFAULT 'general' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "imports_payroll" CHECK ("imports"."kind" <> 'payroll' or ("imports"."file_id" is null and "imports"."grant_id" is null and "imports"."sensitivity" = 'payroll')),
	CONSTRAINT "imports_budget" CHECK ("imports"."kind" <> 'budget' or "imports"."grant_id" is not null),
	CONSTRAINT "imports_confirmed" CHECK ("imports"."status" <> 'confirmed' or ("imports"."confirmed_by" is not null and "imports"."confirmed_at" is not null))
);

CREATE TABLE "payroll_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"grant_id" uuid,
	"category_id" uuid,
	"percent_bp" integer NOT NULL,
	"amount_cents" bigint NOT NULL,
	CONSTRAINT "payroll_allocations_target_key" UNIQUE NULLS NOT DISTINCT("entry_id","category_id"),
	CONSTRAINT "payroll_allocations_target" CHECK (("payroll_allocations"."grant_id" is null) = ("payroll_allocations"."category_id" is null)),
	CONSTRAINT "payroll_allocations_percent" CHECK ("payroll_allocations"."percent_bp" between 1 and 10000),
	CONSTRAINT "payroll_allocations_amount" CHECK ("payroll_allocations"."amount_cents" >= 0)
);

CREATE TABLE "payroll_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"cost_cents" bigint NOT NULL,
	CONSTRAINT "payroll_entries_employee_key" UNIQUE("run_id","employee_id"),
	CONSTRAINT "payroll_entries_cost" CHECK ("payroll_entries"."cost_cents" >= 0)
);

CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"pay_date" date NOT NULL,
	"fingerprint" text NOT NULL,
	"status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"voided_by" uuid,
	"voided_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_runs_import_id_unique" UNIQUE("import_id"),
	CONSTRAINT "payroll_runs_period" CHECK ("payroll_runs"."period_end" >= "payroll_runs"."period_start"),
	CONSTRAINT "payroll_runs_posted" CHECK ("payroll_runs"."status" = 'draft' or ("payroll_runs"."posted_by" is not null and "payroll_runs"."posted_at" is not null)),
	CONSTRAINT "payroll_runs_voided" CHECK ("payroll_runs"."status" <> 'voided' or ("payroll_runs"."voided_by" is not null and "payroll_runs"."voided_at" is not null))
);

CREATE TABLE "receipt_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"grant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"amount_cents" bigint NOT NULL,
	CONSTRAINT "receipt_allocations_category_key" UNIQUE("receipt_id","category_id"),
	CONSTRAINT "receipt_allocations_amount" CHECK ("receipt_allocations"."amount_cents" > 0)
);

CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid,
	"vendor" text,
	"purchased_on" date,
	"total_cents" bigint,
	"description" text,
	"status" "receipt_status" DEFAULT 'draft' NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"voided_by" uuid,
	"voided_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_file_id_unique" UNIQUE("file_id"),
	CONSTRAINT "receipts_total" CHECK ("receipts"."total_cents" > 0),
	CONSTRAINT "receipts_confirmed" CHECK ("receipts"."status" = 'draft' or ("receipts"."total_cents" is not null and "receipts"."confirmed_by" is not null and "receipts"."confirmed_at" is not null)),
	CONSTRAINT "receipts_voided" CHECK ("receipts"."status" <> 'voided' or ("receipts"."voided_by" is not null and "receipts"."voided_at" is not null))
);

CREATE TABLE "warnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "warning_kind" NOT NULL,
	"grant_id" uuid,
	"category_id" uuid,
	"receipt_id" uuid,
	"payroll_run_id" uuid,
	"message" text NOT NULL,
	"extraction_id" uuid,
	"status" "warning_status" DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"sensitivity" "sensitivity" DEFAULT 'general' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warnings_payroll" CHECK ("warnings"."payroll_run_id" is null or "warnings"."sensitivity" = 'payroll'),
	CONSTRAINT "warnings_reviewed" CHECK ("warnings"."status" = 'open' or ("warnings"."reviewed_by" is not null and "warnings"."reviewed_at" is not null))
);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "documents" ADD CONSTRAINT "documents_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grant_contacts" ADD CONSTRAINT "grant_contacts_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grant_contacts" ADD CONSTRAINT "grant_contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grant_links" ADD CONSTRAINT "grant_links_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grant_links" ADD CONSTRAINT "grant_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grants" ADD CONSTRAINT "grants_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "grants" ADD CONSTRAINT "grants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ai_extractions" ADD CONSTRAINT "ai_extractions_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_extraction_id_ai_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."ai_extractions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "ai_proposals" ADD CONSTRAINT "ai_proposals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_deadline_id_deadlines_id_fk" FOREIGN KEY ("deadline_id") REFERENCES "public"."deadlines"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_email_message_id_email_messages_id_fk" FOREIGN KEY ("email_message_id") REFERENCES "public"."email_messages"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_grant_id_budgets_id_grant_id_fk" FOREIGN KEY ("budget_id","grant_id") REFERENCES "public"."budgets"("id","grant_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_category_id_grant_id_budget_categories_id_grant_id_fk" FOREIGN KEY ("category_id","grant_id") REFERENCES "public"."budget_categories"("id","grant_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_award_mismatch_ack_by_users_id_fk" FOREIGN KEY ("award_mismatch_ack_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "employee_splits" ADD CONSTRAINT "employee_splits_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "employee_splits" ADD CONSTRAINT "employee_splits_category_id_grant_id_budget_categories_id_grant_id_fk" FOREIGN KEY ("category_id","grant_id") REFERENCES "public"."budget_categories"("id","grant_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "imports" ADD CONSTRAINT "imports_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "imports" ADD CONSTRAINT "imports_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "imports" ADD CONSTRAINT "imports_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "imports" ADD CONSTRAINT "imports_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payroll_allocations" ADD CONSTRAINT "payroll_allocations_entry_id_payroll_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."payroll_entries"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payroll_allocations" ADD CONSTRAINT "payroll_allocations_category_id_grant_id_budget_categories_id_grant_id_fk" FOREIGN KEY ("category_id","grant_id") REFERENCES "public"."budget_categories"("id","grant_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "receipt_allocations" ADD CONSTRAINT "receipt_allocations_category_id_grant_id_budget_categories_id_grant_id_fk" FOREIGN KEY ("category_id","grant_id") REFERENCES "public"."budget_categories"("id","grant_id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_grant_id_grants_id_fk" FOREIGN KEY ("grant_id") REFERENCES "public"."grants"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_category_id_budget_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."budget_categories"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_extraction_id_ai_extractions_id_fk" FOREIGN KEY ("extraction_id") REFERENCES "public"."ai_extractions"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE INDEX "auth_tokens_user_idx" ON "auth_tokens" USING btree ("user_id");
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email_hash","attempted_at");
CREATE INDEX "login_attempts_ip_idx" ON "login_attempts" USING btree ("ip_hash","attempted_at");
CREATE UNIQUE INDEX "users_email_lower_key" ON "users" USING btree (lower("email"));
CREATE INDEX "deadlines_grant_idx" ON "deadlines" USING btree ("grant_id");
CREATE INDEX "deadlines_due_idx" ON "deadlines" USING btree ("status","due_on");
CREATE INDEX "documents_grant_idx" ON "documents" USING btree ("grant_id");
CREATE INDEX "documents_expires_idx" ON "documents" USING btree ("expires_on");
CREATE INDEX "documents_review_idx" ON "documents" USING btree ("review_on");
CREATE UNIQUE INDEX "documents_one_live_contract" ON "documents" USING btree ("grant_id") WHERE "documents"."category" = 'executed_contract' and "documents"."archived_at" is null;
CREATE INDEX "files_pending_idx" ON "files" USING btree ("status","created_at");
CREATE INDEX "grant_contacts_grant_idx" ON "grant_contacts" USING btree ("grant_id");
CREATE UNIQUE INDEX "grant_contacts_one_primary" ON "grant_contacts" USING btree ("grant_id") WHERE "grant_contacts"."is_primary";
CREATE INDEX "grant_links_grant_idx" ON "grant_links" USING btree ("grant_id");
CREATE INDEX "ai_extractions_file_idx" ON "ai_extractions" USING btree ("file_id");
CREATE INDEX "ai_extractions_usage_idx" ON "ai_extractions" USING btree ("requested_by","created_at");
CREATE INDEX "ai_proposals_extraction_idx" ON "ai_proposals" USING btree ("extraction_id");
CREATE INDEX "audit_log_occurred_idx" ON "audit_log" USING btree ("occurred_at");
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");
CREATE INDEX "audit_log_grant_idx" ON "audit_log" USING btree ("grant_id");
CREATE INDEX "email_messages_created_idx" ON "email_messages" USING btree ("created_at");
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id");
CREATE UNIQUE INDEX "budget_categories_name_key" ON "budget_categories" USING btree ("grant_id",lower("name"));
CREATE INDEX "budget_lines_category_idx" ON "budget_lines" USING btree ("category_id");
CREATE UNIQUE INDEX "budgets_one_approved" ON "budgets" USING btree ("grant_id") WHERE "budgets"."status" = 'approved';
CREATE INDEX "imports_grant_idx" ON "imports" USING btree ("grant_id");
CREATE INDEX "payroll_allocations_category_idx" ON "payroll_allocations" USING btree ("category_id");
CREATE UNIQUE INDEX "payroll_runs_fingerprint_key" ON "payroll_runs" USING btree ("fingerprint") WHERE "payroll_runs"."status" <> 'voided';
CREATE INDEX "receipt_allocations_category_idx" ON "receipt_allocations" USING btree ("category_id");
CREATE INDEX "receipts_duplicate_idx" ON "receipts" USING btree ("total_cents","purchased_on");
CREATE INDEX "warnings_grant_idx" ON "warnings" USING btree ("grant_id","status");