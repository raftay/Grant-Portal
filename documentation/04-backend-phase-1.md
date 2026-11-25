# Backend, Phase 1

Built so far: accounts and sign-in, email, files, organisation, documents. Next: grants, deadlines, alerts, AI.

## Request pattern

Page, action or route handler → `requireUser()` → service function → `asMember`, `asWriter` or `asAdmin` → one transaction as `app_user`.

Services validate their own input with Zod and throw `AppError` with a code (`forbidden`, `not_found`, `invalid`, `conflict`, `throttled`, `unavailable`) and a message fit to show. Database refusals are translated in `src/server/errors.ts`. The role check in a service gives a clear message; Row Level Security is what refuses the write.

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
| `documents` | `createDocument`, `replaceDocumentFile`, `updateDocument`, `archiveDocument`, `listDocuments`, `getDocument` |

A document is expired or overdue from the day after its date, and due soon from 30 days before it, in the organisation's time zone.
