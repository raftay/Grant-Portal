# Testing and acceptance

## Suites

| Command | Covers |
|---|---|
| `npm run check` | No-comment rule, lint, types, and about 1,400 database and service tests |
| `npm run test:e2e` | 19 browser tests of the built app, with accessibility checks |
| `npm run test:demo` | 8 browser tests of the public demo |

## Phase 1 checklist

"Tested" means automated tests pass on a local server with fake data. The last column is still to do on staging.

| Item | State | Still to confirm on staging |
|---|---|---|
| 1.1 Sign-in by password or link, reset, sign-out | Tested | Real email delivery |
| 1.1 Three roles, invite, deactivate, change role, payroll access, 5 accounts | Tested | |
| 1.1 Permissions enforced in the database | Tested | Run the RLS suite against Neon |
| 1.2 Profile with Copy buttons | Tested | |
| 1.2 Document library: upload, view, download, replace, dates, owner | Tested | R2 bucket and CORS |
| 1.2 AI proposes dates for review | Tested with a fake AI server | Real readings |
| 1.3 Needs attention, 30-day and overdue emails | Tested | Vercel Cron, real email |
| 1.4 Grant list, overview, contract, contacts, links, documents | Tested | |
| 1.4 Spent and remaining placeholders | Tested | |
| 1.5 Deadlines with owner, date, status and reminder | Tested | |
| 1.5 AI proposes contract details and deadlines | Tested with a fake AI server | Real readings |
| 1.6 Data model for both phases | Tested | |
| 1.6 Audit log | Tested | |
| 1.6 Private files and sensitive-information notice | Tested | Unsigned R2 address is refused |
| 1.6 Staging site with fake data | Not done | Needs Vercel, Neon and R2 accounts |

## Security requirements

| Requirement | State |
|---|---|
| Running costs at or below US$100 a month | Not measured; nothing is deployed |
| Accounts owned by the agency | Not started |
| Role-based access in the database, payroll restricted | Tested |
| Encryption in transit and at rest, daily backups | Provided by the hosts; confirm when set up |
| Sensitive-information notice | Tested |
| AI terms and minimal data | Only the document and task are sent; provider terms to confirm |
| Fake data only | Yes |
| Usable on a phone | Tested at phone size; not yet on a physical phone |
