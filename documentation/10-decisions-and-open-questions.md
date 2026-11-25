# Decisions and open questions

## Decisions

| Decision | Reason |
|---|---|
| Vercel and Neon, deployed from GitHub Actions | Real sign-in, server-side security and scheduled jobs |
| Migrations run before each deploy; Vercel auto-deploy is off | New code never meets an old schema |
| `pg` driver rather than Neon's HTTP driver | RLS identity needs multi-statement transactions, and the same driver works locally and in CI |
| Password hashes in their own table | The role used by the app has no access to it |
| Budgets are versioned; confirmed receipts and posted payroll are voided and re-entered | Reported numbers keep their history |
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
| Deadline reminder steps? | 30, 14, 7 and 1 days, and overdue |
| Is the Auth.js v5 beta acceptable? | Yes, pinned. Alternatives are v4 or Better Auth, which now maintains Auth.js |
| AI provider? | Anthropic, `claude-haiku-5-5` |

## Known issues

`npm audit` reports moderate advisories in `esbuild`, reached through `drizzle-kit`. It is a development tool and is not deployed.
