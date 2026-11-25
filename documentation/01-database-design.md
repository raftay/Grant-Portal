# Database design

Covers the whole project. Phase 2 tables exist now so that Phase 2 adds screens and services, not schema rewrites. The column list for every table is in [02-database-uml.md](02-database-uml.md).

## Conventions

- UUID keys. Money is `bigint` cents and percentages are integer basis points (10000 = 100%); nothing is stored as a float.
- Business dates are `date`. "Today" uses the time zone on `organization_profile`.
- One organisation per installation.
- Records are archived or voided, not deleted. Deletion is allowed only for contacts, links, drafts and unconfirmed imports.
- Balances and "overdue" are always calculated, never stored.

## Tables

| Group | Table | Purpose and main rules |
|---|---|---|
| Identity | `users` | Role, status, payroll flag, session version. Email unique ignoring case |
| | `user_credentials` | Password hash, kept apart so `app_user` can never read it |
| | `accounts`, `verification_tokens` | Auth.js adapter tables |
| | `auth_tokens` | Single-use invite and reset tokens, stored hashed |
| | `login_attempts` | Sign-in throttling |
| Organisation | `organization_profile` | Single row |
| | `files` | One row per stored object; 15 MB limit; pending until verified |
| | `documents` | No grant means organisation document. One live executed contract per grant |
| | `document_versions` | Replacing a file adds a version; the highest number is current |
| Grants | `grants`, `grant_contacts`, `grant_links`, `deadlines` | Links must be https. A deadline is completed exactly when it has a completion time, and holds its own reminder lead time (`reminder_days`, 1 to 90, default 7). `grants.purpose` is the short description shown on the overview |
| Activity | `notifications` | Unique `dedupe_key` stops repeat alerts |
| | `email_messages` | Send log; body kept only in demo outbox mode |
| | `ai_extractions`, `ai_proposals` | A proposal cannot leave pending without a reviewer, and is locked after review |
| | `audit_log` | Append-only |
| Budgets | `budget_categories`, `budgets`, `budget_lines` | Versioned; one approved budget per grant; approved versions are locked |
| | `imports`, `import_rows` | Payroll imports never keep the source file or raw rows |
| Spending | `receipts`, `receipt_allocations` | Allocations must equal the total when confirmed |
| | `employees`, `employee_splits` | Remembered splits must total 100% |
| | `payroll_runs`, `payroll_entries`, `payroll_allocations` | Splits must total 100% and the exact cost when posted |
| | `warnings` | Flags only; nothing depends on them |

`category_balances` and `grant_balances` are views over approved budgets, confirmed receipts and posted payroll. `recent_activity` is a restricted view over the audit log for the home page.

Composite foreign keys on category and grant make it impossible to charge one grant's category to another grant. A payroll or split line with neither grant nor category means "not grant-funded".

## Who can do what

Enforced by Row Level Security on all 32 tables. A signed-out, unknown, invited or deactivated user sees nothing.

| Data | Admin | Staff | View-only | Extra rule |
|---|---|---|---|---|
| Profile, documents, grants, contacts, links, deadlines | read, write | read, write | read | |
| Users | read, write | read | read | New users can only be created as invited |
| Credentials, tokens, sign-in attempts | none | none | none | `app_system` only |
| Files, imports, warnings | read, write | read, write | read | Payroll rows need the payroll flag |
| AI extractions and proposals | read, write | read, write | none | Payroll rows need the payroll flag |
| Budgets, receipts | read, write | read, write | read | |
| Employees and payroll | with flag | with flag | read with flag | The flag is required for every role |
| Balances | read | read | read | Totals only, no payroll rows |
| Audit log | read | none | none | Payroll entries need the flag |
| Recent activity | read | read | read | Who, what and when only. No values beyond the record's name; no payroll, people, files or AI |
| Notifications | read all | own | own | Written by `app_system` |
| Email log | read | none | none | Written by `app_system` |

## Rules the database enforces

| Rule | Mechanism |
|---|---|
| At most 5 invited or active users | Trigger with a lock, safe under concurrent invites |
| At least one active admin | Trigger |
| Access changes end sessions | Trigger raises `session_version` on role, status, payroll or email change |
| Every change is audited with before and after | Row triggers on every table except tokens, sign-in attempts, notifications, email and the log itself. Password hashes are stripped |
| The audit log cannot be changed | No grants, plus triggers that stop even the owner |
| Creators and approvers cannot be spoofed | Triggers replace the supplied value with the session's user |
| Confirmed and posted records are locked | Triggers; the only next step is void or supersede |
| Receipts and payroll reconcile | Deferred constraint triggers, checked at commit |
| The same payroll is not posted twice | Unique fingerprint among runs that are not voided |

A table owner can still disable triggers. The owner URL is therefore used only by migrations.

## Known limits

- If a category is charged by one employee only, its payroll total reveals that cost to everyone. See [10-decisions-and-open-questions.md](10-decisions-and-open-questions.md).
- `import_rows.category_id` is staging data and is not tied to the import's grant. The check happens when `budget_lines` are written.

## Later features

| Feature (out of scope) | What would be added |
|---|---|
| One document in several grants | A `document_grant_links` table |
| Email inbox alerts | An `inbound_messages` table and a new deadline origin |
| Shared upload inbox | Nothing: files already exist without a document or receipt |
| Search across grants | Generated search columns |
