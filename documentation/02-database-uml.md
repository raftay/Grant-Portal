# Database UML

Generated from `src/db/schema` by `npm run docs:uml`. Do not edit by hand.

- A trailing `?` marks a nullable column.
- Multiplicities come from the foreign keys. A filled diamond means child rows are deleted with their parent, which the database permits only for drafts and unconfirmed imports.
- In the detailed diagrams, a class without attributes belongs to another section.

## Overview

All 32 tables. Links to `users` (owner, creator, approver) are left out here and shown in the detailed diagrams.

```mermaid
classDiagram
  direction LR
  class users
  class user_credentials
  class accounts
  class verification_tokens
  class auth_tokens
  class login_attempts
  class organization_profile
  class files
  class documents
  class document_versions
  class grants
  class grant_contacts
  class grant_links
  class deadlines
  class notifications
  class email_messages
  class ai_extractions
  class ai_proposals
  class audit_log
  class budget_categories
  class budgets
  class budget_lines
  class imports
  class import_rows
  class receipts
  class receipt_allocations
  class employees
  class employee_splits
  class payroll_runs
  class payroll_entries
  class payroll_allocations
  class warnings
  files "0..1" --> "0..*" ai_extractions
  grants "0..1" --> "0..*" ai_extractions
  ai_extractions "1" --> "0..*" ai_proposals
  grants "1" --> "0..*" budget_categories
  budgets "1" *-- "0..*" budget_lines
  budget_categories "1" --> "0..*" budget_lines
  grants "1" --> "0..*" budgets
  imports "0..1" --> "0..1" budgets
  grants "1" --> "0..*" deadlines
  documents "1" --> "0..*" document_versions
  files "1" --> "0..1" document_versions
  grants "0..1" --> "0..*" documents
  employees "1" --> "0..*" employee_splits
  budget_categories "0..1" --> "0..*" employee_splits
  grants "1" --> "0..*" grant_contacts
  grants "1" --> "0..*" grant_links
  imports "1" *-- "0..*" import_rows
  budget_categories "0..1" --> "0..*" import_rows
  files "0..1" --> "0..*" imports
  grants "0..1" --> "0..*" imports
  documents "0..1" --> "0..*" notifications
  deadlines "0..1" --> "0..*" notifications
  email_messages "0..1" --> "0..1" notifications
  payroll_entries "1" *-- "0..*" payroll_allocations
  budget_categories "0..1" --> "0..*" payroll_allocations
  payroll_runs "1" *-- "0..*" payroll_entries
  employees "1" --> "0..*" payroll_entries
  imports "0..1" --> "0..1" payroll_runs
  receipts "1" *-- "0..*" receipt_allocations
  budget_categories "1" --> "0..*" receipt_allocations
  files "0..1" --> "0..1" receipts
  grants "0..1" --> "0..*" warnings
  budget_categories "0..1" --> "0..*" warnings
  receipts "0..1" --> "0..*" warnings
  payroll_runs "0..1" --> "0..*" warnings
  ai_extractions "0..1" --> "0..*" warnings
```

## Identity

```mermaid
classDiagram
  direction LR
  class users {
    +uuid id
    +text name
    +text email
    +timestamptz email_verified?
    +text image?
    +user_role role
    +user_status status
    +boolean can_view_payroll
    +integer session_version
    +uuid invited_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class user_credentials {
    +uuid user_id
    +text password_hash
    +timestamptz updated_at
  }
  class accounts {
    +uuid user_id
    +text type
    +text provider
    +text provider_account_id
    +text refresh_token?
    +text access_token?
    +integer expires_at?
    +text token_type?
    +text scope?
    +text id_token?
    +text session_state?
  }
  class verification_tokens {
    +text identifier
    +text token
    +timestamptz expires
  }
  class auth_tokens {
    +uuid id
    +uuid user_id
    +token_purpose purpose
    +text token_hash
    +timestamptz expires_at
    +timestamptz used_at?
    +timestamptz created_at
  }
  class login_attempts {
    +bigint id
    +text email_hash
    +text ip_hash
    +boolean succeeded
    +timestamptz attempted_at
  }
  users "1" --> "0..*" accounts : user_id
  users "1" --> "0..*" auth_tokens : user_id
  users "1" --> "0..1" user_credentials : user_id
  users "0..1" --> "0..*" users : invited_by
```

## Organisation, documents, grants and deadlines

```mermaid
classDiagram
  direction LR
  class organization_profile {
    +integer id
    +text legal_name
    +text ein?
    +text address_line1?
    +text address_line2?
    +text city?
    +text state?
    +text postal_code?
    +integer fiscal_year_start_month
    +integer fiscal_year_start_day
    +text signer_name?
    +text signer_title?
    +text signer_email?
    +text timezone
    +timestamptz created_at
    +timestamptz updated_at
  }
  class files {
    +uuid id
    +text storage_key
    +text original_name
    +text mime_type
    +bigint size_bytes
    +text sha256?
    +file_status status
    +sensitivity sensitivity
    +uuid uploaded_by?
    +timestamptz ready_at?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class documents {
    +uuid id
    +uuid grant_id?
    +text title
    +document_category category
    +date expires_on?
    +date review_on?
    +uuid owner_id?
    +text notes?
    +timestamptz archived_at?
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class document_versions {
    +uuid id
    +uuid document_id
    +integer version_no
    +uuid file_id
    +uuid uploaded_by?
    +timestamptz created_at
  }
  class grants {
    +uuid id
    +text name
    +text code
    +text funder_name
    +text award_number?
    +bigint award_cents
    +date awarded_on?
    +date starts_on
    +date ends_on
    +uuid owner_id?
    +grant_status status
    +text terms_text?
    +integer sort_order
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class grant_contacts {
    +uuid id
    +uuid grant_id
    +text name
    +text title?
    +text agency?
    +text email?
    +text phone?
    +boolean is_primary
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class grant_links {
    +uuid id
    +uuid grant_id
    +text label
    +text url
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class deadlines {
    +uuid id
    +uuid grant_id
    +deadline_type type
    +text title
    +text description?
    +date due_on
    +uuid owner_id?
    +deadline_status status
    +timestamptz completed_at?
    +uuid completed_by?
    +deadline_origin origin
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  grants "1" --> "0..*" deadlines : grant_id
  users "0..1" --> "0..*" deadlines : owner_id
  users "0..1" --> "0..*" deadlines : completed_by
  users "0..1" --> "0..*" deadlines : created_by
  documents "1" --> "0..*" document_versions : document_id
  files "1" --> "0..1" document_versions : file_id
  users "0..1" --> "0..*" document_versions : uploaded_by
  grants "0..1" --> "0..*" documents : grant_id
  users "0..1" --> "0..*" documents : owner_id
  users "0..1" --> "0..*" documents : created_by
  users "0..1" --> "0..*" files : uploaded_by
  grants "1" --> "0..*" grant_contacts : grant_id
  users "0..1" --> "0..*" grant_contacts : created_by
  grants "1" --> "0..*" grant_links : grant_id
  users "0..1" --> "0..*" grant_links : created_by
  users "0..1" --> "0..*" grants : owner_id
  users "0..1" --> "0..*" grants : created_by
```

## Alerts, AI and audit

```mermaid
classDiagram
  direction LR
  class notifications {
    +uuid id
    +notification_kind kind
    +uuid recipient_id
    +uuid document_id?
    +uuid deadline_id?
    +date due_on
    +text milestone
    +text dedupe_key
    +uuid email_message_id?
    +timestamptz created_at
  }
  class email_messages {
    +uuid id
    +text kind
    +text to_email
    +text subject
    +text body_html?
    +email_status status
    +integer attempts
    +text provider_id?
    +text error?
    +timestamptz sent_at?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class ai_extractions {
    +uuid id
    +ai_kind kind
    +uuid file_id?
    +uuid grant_id?
    +ai_status status
    +text model
    +text prompt_version
    +integer input_tokens?
    +integer output_tokens?
    +text error?
    +sensitivity sensitivity
    +uuid requested_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class ai_proposals {
    +uuid id
    +uuid extraction_id
    +integer group_no
    +text target_entity
    +text target_field
    +jsonb proposed_value
    +text evidence?
    +integer page_no?
    +proposal_status status
    +jsonb final_value?
    +uuid reviewed_by?
    +timestamptz reviewed_at?
    +uuid applied_entity_id?
    +timestamptz created_at
  }
  class audit_log {
    +bigint id
    +timestamptz occurred_at
    +uuid actor_id?
    +actor_kind actor_kind
    +text action
    +text entity_type
    +text entity_id?
    +uuid grant_id?
    +jsonb before?
    +jsonb after?
    +text request_id?
    +sensitivity sensitivity
  }
  files "0..1" --> "0..*" ai_extractions : file_id
  grants "0..1" --> "0..*" ai_extractions : grant_id
  users "0..1" --> "0..*" ai_extractions : requested_by
  ai_extractions "1" --> "0..*" ai_proposals : extraction_id
  users "0..1" --> "0..*" ai_proposals : reviewed_by
  users "0..1" --> "0..*" audit_log : actor_id
  users "1" --> "0..*" notifications : recipient_id
  documents "0..1" --> "0..*" notifications : document_id
  deadlines "0..1" --> "0..*" notifications : deadline_id
  email_messages "0..1" --> "0..1" notifications : email_message_id
```

## Budgets and imports (Phase 2)

```mermaid
classDiagram
  direction LR
  class budget_categories {
    +uuid id
    +uuid grant_id
    +text name
    +text code?
    +budget_category_kind kind
    +boolean is_salary
    +integer sort_order
    +timestamptz archived_at?
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class budgets {
    +uuid id
    +uuid grant_id
    +integer version_no
    +budget_status status
    +uuid import_id?
    +uuid approved_by?
    +timestamptz approved_at?
    +uuid award_mismatch_ack_by?
    +timestamptz award_mismatch_ack_at?
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class budget_lines {
    +uuid id
    +uuid budget_id
    +uuid grant_id
    +uuid category_id
    +text description?
    +bigint amount_cents
    +integer sort_order
  }
  class imports {
    +uuid id
    +import_kind kind
    +uuid file_id?
    +uuid grant_id?
    +import_status status
    +text sheet_name?
    +integer header_row?
    +jsonb column_mapping?
    +uuid confirmed_by?
    +timestamptz confirmed_at?
    +sensitivity sensitivity
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class import_rows {
    +uuid id
    +uuid import_id
    +integer row_no
    +jsonb raw?
    +jsonb parsed?
    +import_row_status status
    +uuid category_id?
    +text message?
  }
  grants "1" --> "0..*" budget_categories : grant_id
  users "0..1" --> "0..*" budget_categories : created_by
  budgets "1" *-- "0..*" budget_lines : budget_id + grant_id
  budget_categories "1" --> "0..*" budget_lines : category_id + grant_id
  grants "1" --> "0..*" budgets : grant_id
  imports "0..1" --> "0..1" budgets : import_id
  users "0..1" --> "0..*" budgets : approved_by
  users "0..1" --> "0..*" budgets : award_mismatch_ack_by
  users "0..1" --> "0..*" budgets : created_by
  imports "1" *-- "0..*" import_rows : import_id
  budget_categories "0..1" --> "0..*" import_rows : category_id
  files "0..1" --> "0..*" imports : file_id
  grants "0..1" --> "0..*" imports : grant_id
  users "0..1" --> "0..*" imports : confirmed_by
  users "0..1" --> "0..*" imports : created_by
```

## Receipts, payroll and warnings (Phase 2)

```mermaid
classDiagram
  direction LR
  class receipts {
    +uuid id
    +uuid file_id?
    +text vendor?
    +date purchased_on?
    +bigint total_cents?
    +text description?
    +receipt_status status
    +uuid confirmed_by?
    +timestamptz confirmed_at?
    +uuid voided_by?
    +timestamptz voided_at?
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class receipt_allocations {
    +uuid id
    +uuid receipt_id
    +uuid grant_id
    +uuid category_id
    +bigint amount_cents
  }
  class employees {
    +uuid id
    +text external_ref
    +text display_name
    +boolean is_active
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class employee_splits {
    +uuid id
    +uuid employee_id
    +uuid grant_id?
    +uuid category_id?
    +integer percent_bp
  }
  class payroll_runs {
    +uuid id
    +uuid import_id?
    +date period_start
    +date period_end
    +date pay_date
    +text fingerprint
    +payroll_run_status status
    +uuid posted_by?
    +timestamptz posted_at?
    +uuid voided_by?
    +timestamptz voided_at?
    +uuid created_by?
    +timestamptz created_at
    +timestamptz updated_at
  }
  class payroll_entries {
    +uuid id
    +uuid run_id
    +uuid employee_id
    +bigint cost_cents
  }
  class payroll_allocations {
    +uuid id
    +uuid entry_id
    +uuid grant_id?
    +uuid category_id?
    +integer percent_bp
    +bigint amount_cents
  }
  class warnings {
    +uuid id
    +warning_kind kind
    +uuid grant_id?
    +uuid category_id?
    +uuid receipt_id?
    +uuid payroll_run_id?
    +text message
    +uuid extraction_id?
    +warning_status status
    +uuid reviewed_by?
    +timestamptz reviewed_at?
    +sensitivity sensitivity
    +timestamptz created_at
    +timestamptz updated_at
  }
  employees "1" --> "0..*" employee_splits : employee_id
  budget_categories "0..1" --> "0..*" employee_splits : category_id + grant_id
  users "0..1" --> "0..*" employees : created_by
  payroll_entries "1" *-- "0..*" payroll_allocations : entry_id
  budget_categories "0..1" --> "0..*" payroll_allocations : category_id + grant_id
  payroll_runs "1" *-- "0..*" payroll_entries : run_id
  employees "1" --> "0..*" payroll_entries : employee_id
  imports "0..1" --> "0..1" payroll_runs : import_id
  users "0..1" --> "0..*" payroll_runs : posted_by
  users "0..1" --> "0..*" payroll_runs : voided_by
  users "0..1" --> "0..*" payroll_runs : created_by
  receipts "1" *-- "0..*" receipt_allocations : receipt_id
  budget_categories "1" --> "0..*" receipt_allocations : category_id + grant_id
  files "0..1" --> "0..1" receipts : file_id
  users "0..1" --> "0..*" receipts : confirmed_by
  users "0..1" --> "0..*" receipts : voided_by
  users "0..1" --> "0..*" receipts : created_by
  grants "0..1" --> "0..*" warnings : grant_id
  budget_categories "0..1" --> "0..*" warnings : category_id
  receipts "0..1" --> "0..*" warnings : receipt_id
  payroll_runs "0..1" --> "0..*" warnings : payroll_run_id
  ai_extractions "0..1" --> "0..*" warnings : extraction_id
  users "0..1" --> "0..*" warnings : reviewed_by
```
