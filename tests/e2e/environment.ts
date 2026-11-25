import { urlFor } from "../helpers/config";

export const database = "grant_portal_e2e";
export const password = "end-to-end-password";

export const environment = {
  DATABASE_URL: urlFor("app_user", "app_user", database),
  DATABASE_SYSTEM_URL: urlFor("app_system", "app_system", database),
  AUTH_SECRET: "end-to-end-secret-end-to-end-secret-0",
  AUTH_TRUST_HOST: "true",
  AUTH_URL: "http://localhost:3000",
  APP_URL: "http://localhost:3000",
  SAMPLE_DATA: "true",
  CRON_SECRET: "end-to-end-cron-secret-end-to-end-00",
  ANTHROPIC_API_KEY: "end-to-end",
  ANTHROPIC_BASE_URL: "http://127.0.0.1:3999",
  EMAIL_MODE: "outbox",
  EMAIL_FROM: "Portal <portal@example.org>",
  R2_ENDPOINT: "http://127.0.0.1:57070",
  R2_BUCKET: "grant-portal-e2e",
  R2_ACCESS_KEY_ID: "local-access",
  R2_SECRET_ACCESS_KEY: "local-secret-key",
  SEED_PASSWORD: password,
};
