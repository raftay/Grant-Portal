# Architecture

## System diagram

```mermaid
flowchart LR
  subgraph Client
    B[Browser: desktop or phone]
  end
  subgraph GitHub
    R[Repo: code, migrations, documentation]
    A[Actions: checks, RLS tests, migrate, deploy]
  end
  subgraph Vercel
    P[Pages and server components]
    S[Server actions and route handlers]
    AU[Auth.js]
    SV[Services: validation and business rules]
    C[Vercel Cron: daily]
  end
  subgraph Neon[Neon Postgres]
    U[(app_user: RLS enforced)]
    Y[(app_system: auth and daily job)]
    O[(owner: migrations only)]
  end
  R2[(Cloudflare R2 private bucket)]
  AI[Anthropic API]
  M[Resend]

  B --> P --> S --> SV
  B --> AU
  SV -->|one transaction per request, with user id| U
  AU --> Y
  C -->|CRON_SECRET| S
  S -->|daily job| Y
  B -->|signed PUT, 5 minutes| R2
  B -->|signed GET, 60 seconds| R2
  SV -->|sign, check, read| R2
  SV -->|structured extraction| AI
  SV --> M
  AU --> M
  R --> A
  A -->|owner URL| O
  A -->|vercel deploy --prod| P
```

Status: the database, sign-in, email, file storage, and the user, organisation and document services exist. Grants, deadlines, alerts, AI and all screens are designed but not built yet.

## Why GitHub Pages is not the host

Pages serves static files only. It cannot run sign-in, hold an AI key, run the daily job, or keep database credentials away from the browser. GitHub therefore holds the code, migrations and pipeline; Vercel runs the app; Neon holds the data.

## How a request reaches data

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Server action
  participant S as Service
  participant D as Postgres as app_user
  B->>A: submit form
  A->>A: check session, validate input
  A->>S: call with user id
  S->>D: begin, set app.user_id for this transaction
  S->>D: query
  D->>D: look up role and status, apply RLS, run triggers, write audit row
  D-->>S: rows, or nothing if not allowed
  S->>D: commit
  S-->>B: result
```

The app passes only a user id. The database looks up the role, status and payroll flag itself, so a demoted or deactivated user loses access on the next statement, and a bug in the UI cannot widen access.

## Database connections

| Role | Used by | Where the URL lives | Limits |
|---|---|---|---|
| owner | Migrations and role setup | GitHub Actions secret; never in Vercel | Bypasses RLS |
| `app_user` | Everything a signed-in person does | Vercel | RLS on every table |
| `app_system` | Sign-in, tokens, daily job | Vercel | Named tables only, no payroll, cannot change roles |

`app_user` and `app_system` must be created by `npm run db:roles`. Roles made in the Neon console inherit BYPASSRLS; the script refuses to continue if it finds that.

Identity uses `set_config(..., true)`, which lasts for one transaction, so it is safe behind Neon's transaction-mode pooler.

## Stack

| Job | Tool | State |
|---|---|---|
| App | Next.js, TypeScript, Tailwind, shadcn/ui | Shell installed; shadcn/ui pending |
| Database | Neon Postgres, Drizzle, `pg` | Built; Neon project pending |
| Sign-in | Auth.js, pinned to 5.0.0-beta.32 | Built |
| Files | Cloudflare R2 | Built; tested on an S3-compatible server, R2 account pending |
| Schedule | Vercel Cron | Pending |
| Email | Resend | Built; only outbox mode has been run |
| AI | Anthropic, `claude-haiku-5-5` | Pending |
| Spreadsheets | SheetJS | Phase 2 |
