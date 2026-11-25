# Decisions and open questions

## Decisions

| Decision | Reason |
|---|---|
| Vercel and Neon, deployed from GitHub Actions | Real sign-in, server-side security and scheduled jobs |
| Migrations run before each deploy; Vercel auto-deploy is off | New code never meets an old schema |
| `pg` driver rather than Neon's HTTP driver | RLS identity needs multi-statement transactions, and the same driver works locally and in CI |
| Password hashes in their own table | The role used by the app has no access to it |
| Budgets are versioned; confirmed receipts and posted payroll are voided and re-entered | Reported numbers keep their history |
| One reminder per deadline, set on the deadline | Matches the design; replaces a fixed series of reminders |
| `recent_activity` view | Everyone sees activity on the home page while the full log stays with admins |
| The design was read from a small public preview | Detail is approximate until full-size screens are available |
| TypeScript 6.0 and ESLint 9 | The lint plugins do not support TypeScript 7 |

## Open questions

| Question | Proposed answer |
|---|---|
| Do deactivated users count toward 5? | No; invited and active users do |
| Do admins see payroll automatically? | No. The flag is explicit; an admin can grant it to themselves and that is logged |
| Is it acceptable that a one-person category total reveals a salary? | Yes, unless totals should also be restricted |
| Must payroll splits cover pay that is not grant-funded? | Yes, with a "not grant-funded" share so splits reach 100% |
| Keep the raw payroll export? | No; only the needed fields |
| How often do overdue emails repeat? | Once |
| Default deadline reminder? | 7 days before, editable per deadline, plus one email when overdue |
| Deadlines in "Needs attention", and an all-grants deadlines page? | Yes, as in the design. The scope document lists neither |
| Is the Auth.js v5 beta acceptable? | Yes, pinned. Alternatives are v4 or Better Auth, which now maintains Auth.js |
| AI provider? | Anthropic, `claude-haiku-5-5` |

## Known issues

`npm audit` reports moderate advisories in `esbuild`, reached through `drizzle-kit`. It is a development tool and is not deployed.
