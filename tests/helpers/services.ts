import { randomUUID } from "node:crypto";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Client, type QueryResultRow } from "pg";
import { adminUrl, templateDatabase, urlFor } from "./config";

const storage = {
  R2_ENDPOINT: "http://127.0.0.1:57070",
  R2_BUCKET: `test-${randomUUID().slice(0, 8)}`,
  R2_ACCESS_KEY_ID: "local-access",
  R2_SECRET_ACCESS_KEY: "local-secret-key",
};

export async function prepareServices(overrides: Record<string, string> = {}): Promise<{
  query: <T extends QueryResultRow>(text: string, values?: unknown[]) => Promise<T[]>;
  close: () => Promise<void>;
}> {
  const name = `grant_portal_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`create database ${name} template ${templateDatabase}`);
  Object.assign(process.env, storage, {
    DATABASE_URL: urlFor("app_user", "app_user", name),
    DATABASE_SYSTEM_URL: urlFor("app_system", "app_system", name),
    AUTH_SECRET: "test-secret-test-secret-test-secret-0",
    AUTH_TRUST_HOST: "true",
    APP_URL: "https://portal.example.org",
    SAMPLE_DATA: "true",
    CRON_SECRET: "test-cron-secret-test-cron-secret-00",
    ANTHROPIC_API_KEY: "test-key",
    EMAIL_MODE: "outbox",
    EMAIL_FROM: "Portal <portal@example.org>",
    ...overrides,
  });
  const s3 = new S3Client({
    region: "auto",
    endpoint: storage.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: storage.R2_ACCESS_KEY_ID, secretAccessKey: storage.R2_SECRET_ACCESS_KEY },
  });
  await s3.send(new CreateBucketCommand({ Bucket: storage.R2_BUCKET }));
  s3.destroy();
  const owner = new Client({ connectionString: urlFor(null, null, name) });
  await owner.connect();
  return {
    query: async (text, values) => (await owner.query(text, values)).rows,
    close: async () => {
      const { database } = await import("@/db/client");
      await database("DATABASE_URL").$client.end();
      await database("DATABASE_SYSTEM_URL").$client.end();
      await owner.end();
      await admin.query(`drop database ${name} with (force)`);
      await admin.end();
    },
  };
}
