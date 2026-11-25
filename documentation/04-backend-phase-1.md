# Backend, Phase 1

Complete for Phase 1. Screens and the server actions that call these services come next.

## Request pattern

Page, action or route handler → `requireUser()` → service function → `asMember`, `asWriter` or `asAdmin` → one transaction as `app_user`.

Services validate their own input with Zod and throw `AppError` with a code (`forbidden`, `not_found`, `invalid`, `conflict`, `throttled`, `unavailable`) and a message fit to show. Database refusals are translated in `src/server/errors.ts`. The role check in a service gives a clear message; Row Level Security is what refuses the write.

## Errors

There are no fallbacks, retries or backup paths. A failing function throws. Where a failure must leave a trace (an email, an AI reading), it is recorded and then rethrown. Required configuration and rows are never defaulted.

Only `src/server/auth`, `email` and `jobs` may use the `app_system` connection. ESLint enforces it.

## Sign-in

| Topic | Behaviour |
|---|---|
| Methods | Password, or an emailed link that lasts 15 minutes and works once |
| Accounts | By invitation only |
| Sessions | Signed cookie, up to 8 hours. Each request re-checks status and `session_version`, so a reset, role or payroll change, or deactivation ends the session |
| Passwords | scrypt (N 65536, r 8, p 1), 12 to 128 characters |
| Throttling | 5 failures per account or 20 per address in 15 minutes. The count is taken under a lock, so parallel guesses cannot pass it |
| Privacy | Reset and link requests give the same answer whether or not an account exists |
| Email limits | 3 emails of one kind per address per hour |
| Invites and resets | Single use, stored hashed, 72 hours and 1 hour. A new link cancels the old one |

## Files

1. `createUpload` checks role, type and size, records a pending file, and returns a 5-minute signed PUT to `incoming/`.
2. The browser uploads directly to storage. The signature fixes the type and size.
3. `finalizeUpload` checks size and leading bytes, writes the checked bytes to the final location, and deletes the incoming copy.
4. `GET /api/files/{id}?mode=view|download` checks access, logs it, and redirects to a 60-second link.

Only the uploader can finish an upload or attach the file to a document. Payroll files cannot be attached to documents.

## Services

| Service | Functions |
|---|---|
| `users` | `listUsers`, `listOwners`, `inviteUser`, `resendInvite`, `changeRole`, `setPayrollAccess`, `deactivateUser`, `reactivateUser` |
| `organization` | `getOrganization`, `saveOrganization` |
| `files` | `createUpload`, `finalizeUpload`, `openFile` |
| `grants` | `listGrants`, `getGrant`, `createGrant`, `updateGrant`, and add, update and remove for contacts and links |
| `deadlines` | `listDeadlines`, `createDeadline`, `updateDeadline` |
| `overview` | `listAttention`, `getSummary`, `listActivity`; admins: `listAudit`, `listAccessChanges`, `listEmails` |
| `alerts` | `runAlertsNow` (admins) |
| `ai` | `readDocumentDates`, `readContract`, `getExtraction`, `createReviewedDocument`, `confirmDocumentDates`, `confirmContract`, `discardExtraction` |
| `documents` | `createDocument`, `replaceDocumentFile`, `updateDocument`, `archiveDocument`, `listDocuments`, `getDocument` |

A document is expired or overdue from the day after its date, and due soon from 30 days before it, in the organisation's time zone.

Needs attention lists documents from 30 days before their date, and deadlines once inside their own reminder window.

Spent and remaining are returned as "not available until Phase 2", never as zero.

## Daily alerts

Vercel Cron calls `/api/cron/daily` once a day with `CRON_SECRET`. Admins can also run it by hand.

| Item | Emails to the owner |
|---|---|
| Document expiry or review | Once from 30 days before, once when overdue |
| Deadline | Once from its own `reminder_days` before, once when overdue |

- Each email has a unique key of item, date, step and recipient. Reruns and overlapping runs do not repeat it, and changing the date alerts again.
- A late-added item or a missed day still alerts, because the test is "inside the window and not yet sent".
- Items without an active owner get no email. They still appear under Needs attention.
- If one email fails the run stops with an error. That alert and those after it stay unsent and are picked up by the next run.
- Uploads left unfinished for a day are marked failed and removed.

## AI reading

`claude-haiku-5-5` reads a PDF, PNG or JPEG and returns a fixed structure: a value, a quote and a page for each field. It has no tools, and only the document and the task are sent.

1. `readDocumentDates` or `readContract` stores pending proposals. Nothing else is saved.
2. A person edits the form, ticks "reviewed" and confirms.
3. The confirm function saves the records and marks each proposal accepted, edited or rejected, in one transaction. It works once.

Errors, refusals, cut-off answers, invalid dates or amounts, and documents over 100,000 tokens throw and are recorded as failed. The manual forms do not depend on AI, so they work regardless. Limits: 20 readings per person and 60 overall in 24 hours.
