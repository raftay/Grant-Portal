# Security

| Requirement | Control | Tested by |
|---|---|---|
| Access enforced in the database | RLS on all 32 tables, restricted roles | `tests/rls` |
| Payroll limited to approved people | `can_view_payroll`, checked in RLS | `tests/rls`, `tests/services` |
| Private files | No public access, random keys, 60-second links, access logged | `tests/services/library` |
| Upload safety | Type and size signed, contents checked, verified copy kept | `tests/services/library` |
| Audit of uploads, approvals and edits | Triggers and `app.log_event`, append-only | `tests/integrity/audit` |
| Sessions end when access changes | `session_version` | `tests/services/accounts` |
| Guessing | Throttling per account and address | `tests/services/accounts` |
| Secrets | Environment variables only; the owner URL never reaches Vercel | Review |

## Limits to know about

- File checks confirm the type, not that a file is harmless. There is no malware scanning.
- Outbox mode stores sign-in, invite and reset links where admins can read them. Use it for demos only.
- Throttling uses the address the host reports. On Vercel that header is set by the platform; elsewhere, put a trusted proxy in front.
- A `pending` upload that is never finished leaves an object under `incoming/`. Add a one-day lifecycle rule for that prefix.
- Production settings for backups and point-in-time restore belong to the launch work and are not set up for the demo.
