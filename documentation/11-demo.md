# Public demo

A copy of the portal that runs entirely in the visitor's browser, for GitHub Pages. Address once published: `https://raftay.github.io/Grant-Portal/`.

## Accounts

| Type | Email | Password |
|---|---|---|
| Admin | alex@example.org | Harbor-Admin-2026 |
| Staff | jamie@example.org | Harbor-Staff-2026 |
| Staff, no payroll access | sam@example.org | Harbor-Staff2-2026 |
| View-only | taylor@example.org | Harbor-View-2026 |

These are fictional people. The passwords are public and work only in the demo.

## What is real and what is not

| Part | In the demo |
|---|---|
| Pages, forms, services, validation | The same code as the portal |
| Database | Real Postgres compiled to WebAssembly (PGlite), with the same migrations, triggers and access rules, saved in the browser |
| Sign-in | The same service checks; the session is kept in the browser tab |
| Files | Kept in the browser database |
| Email | Shown in the Demo inbox |
| AI | Simulated: a text search of the sample PDFs. Other files report that AI could not read them |
| Daily alerts | Run by hand from the Demo inbox |

## Limits

- Each visitor has their own copy. Nothing is shared between people or devices.
- It demonstrates the access rules but is not a security boundary: a visitor owns the browser that runs it. Never put real data in it.
- The data is dated from the first visit. "Reset the demo data" on the sign-in page starts again.
- The first visit downloads about 17 MB.

## Publishing

1. In the repository, open Settings, Pages, and set Source to GitHub Actions. This is needed once.
2. Every push to `main` builds, tests and publishes it. The `demo` workflow can also be run by hand.

Locally: `npm run demo:build`, then `npm run demo:preview`, or `npm run test:demo`.

## How it works

`demo/vite.config.ts` swaps server-only modules (database connection, storage, sign-in transport, AI client, environment) for versions in `demo/shims`. Everything else is imported from `src`.
