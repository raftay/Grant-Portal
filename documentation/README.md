# Grant Portal

A portal for a small nonprofit to manage grant documents, deadlines and alerts. All data in this repository is fictional.

## Run it locally

Needs Node 22.12+, 24 or 26+, and Docker. CI uses Node 24.

1. `npm ci`
2. Copy `.env.example` to `.env.local`
3. `npm run db:up`
4. `npm run db:roles`, then `npm run db:migrate`
5. `npm run dev`

`npm run check` runs the comment check, lint, type check and tests. Tests use a separate database that is rebuilt on every run.

## Documents

| File | Contents |
|---|---|
| [01-database-design.md](01-database-design.md) | Tables, access rules, enforced rules |
| [02-database-uml.md](02-database-uml.md) | UML class diagrams, generated |
| [03-architecture.md](03-architecture.md) | System diagram, request flow, connections |
| [10-decisions-and-open-questions.md](10-decisions-and-open-questions.md) | Decisions and questions for the client |

Numbers 04 to 09 (backend, frontend, security, deployment, testing, admin guide) arrive with the steps they describe.

## Rule

Documentation lives only in this folder. Nothing else in the repository contains comments, and CI enforces it. After changing the schema, run `npm run db:generate` and `npm run docs:uml`.

Drizzle starts custom migrations with a comment line; delete it.
