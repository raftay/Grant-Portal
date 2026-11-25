# Grant Portal

A portal for a small nonprofit to manage grant documents, deadlines and alerts. All data in this repository is fictional.

## Run it locally

Needs Node 22.12+, 24 or 26+, and Docker. CI uses Node 24.

1. `npm ci`
2. Copy `.env.example` to `.env.local`
3. `npm run db:up` (Postgres and an S3-compatible store)
4. `npm run db:roles`, `npm run db:migrate`, `npm run storage:create`, `npm run db:seed`
5. `npm run dev`, then sign in as `alex@example.org` with the `SEED_PASSWORD` from `.env.local`

`npm run db:reset` empties a local database so it can be seeded again with fresh dates.

`npm run check` runs the comment check, lint, type check and tests. Tests use a separate database that is rebuilt on every run. `npm run build` then `npm run test:e2e` drives the real app in a browser (`npx playwright install chromium` once).

## Documents

| File | Contents |
|---|---|
| [01-database-design.md](01-database-design.md) | Tables, access rules, enforced rules |
| [02-database-uml.md](02-database-uml.md) | UML class diagrams, generated |
| [03-architecture.md](03-architecture.md) | System diagram, request flow, connections |
| [04-backend-phase-1.md](04-backend-phase-1.md) | Request pattern, sign-in, files, services |
| [05-frontend-phase-1.md](05-frontend-phase-1.md) | Screens, design rules, loader |
| [06-security.md](06-security.md) | Controls, where they live, how they are tested |
| [07-setup-and-deployment.md](07-setup-and-deployment.md) | Environment variables, storage, email, deploys |
| [10-decisions-and-open-questions.md](10-decisions-and-open-questions.md) | Decisions and questions for the client |

Numbers 08 and 09 (acceptance checklist, admin guide) arrive with the final step.

## Rule

Documentation lives only in this folder. Nothing else in the repository contains comments, and CI enforces it. After changing the schema, run `npm run db:generate` and `npm run docs:uml`.

Drizzle starts custom migrations with a comment line; delete it.
