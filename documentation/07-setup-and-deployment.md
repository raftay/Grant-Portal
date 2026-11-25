# Setup and deployment

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_OWNER_URL` | GitHub secret, local | Migrations and role setup only |
| `APP_USER_PASSWORD`, `APP_SYSTEM_PASSWORD` | Local shell | Used once by `npm run db:roles` |
| `DATABASE_URL` | Vercel | `app_user`, pooled |
| `DATABASE_SYSTEM_URL` | Vercel | `app_system`, pooled |
| `AUTH_SECRET` | Vercel | At least 32 random characters |
| `AUTH_TRUST_HOST` | Local | `true` when not on Vercel |
| `APP_URL` | Vercel | Base address used in emails |
| `CRON_SECRET` | Vercel | At least 32 random characters; Vercel Cron sends it |
| `ANTHROPIC_API_KEY` | Vercel, local | AI reading. Set a spend limit on the account |
| `EMAIL_MODE` | Vercel | `resend` to send, `outbox` to store for the demo |
| `EMAIL_FROM` | Vercel | Sender on a verified domain |
| `RESEND_API_KEY` | Vercel | Required when `EMAIL_MODE` is `resend` |
| `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Vercel | Private bucket |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | GitHub secrets | Deploys |

## First deployment

1. Create the Neon project. Run `npm run db:roles` with the owner URL and two strong passwords, then `npm run db:migrate`.
2. Create a private R2 bucket. Allow PUT and GET from the app address in its CORS rules, with the `content-type` header. Add a one-day lifecycle rule for `incoming/`.
3. Create the Vercel project and set the variables above.
4. Add the GitHub secrets in an environment called `production`, and set the repository variable `DEPLOY_ENABLED` to `true`.
5. Push to `main`.

Resend sends to anyone only after its domain is verified. Vercel's Hobby plan is for non-commercial use.

## Local storage

`npm run db:up` starts an S3-compatible server on port 57070. Its data is temporary. Create the bucket once with `npm run storage:create`.

## Changing dependencies

Some npm versions drop optional packages from the lockfile, and `npm ci` then fails in CI. After changing `package.json`, delete `package-lock.json` and rebuild it with the Node version CI uses:

`docker run --rm -v "$PWD":/app -w /app -e HOME=/tmp --user "$(id -u):$(id -g)" node:24 npm install --package-lock-only`
