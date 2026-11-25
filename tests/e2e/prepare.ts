import { execFileSync } from "node:child_process";
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { createRoles, runMigrations } from "../../scripts/lib/database";
import { adminUrl, urlFor } from "../helpers/config";
import { database, environment } from "./environment";

const admin = new Client({ connectionString: adminUrl });
await admin.connect();
await admin.query(`drop database if exists ${database} with (force)`);
await admin.query(`create database ${database}`);
await admin.end();
await createRoles(adminUrl, "app_user", "app_system");
await runMigrations(urlFor(null, null, database));

const storage = new S3Client({
  region: "auto",
  endpoint: environment.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: environment.R2_ACCESS_KEY_ID, secretAccessKey: environment.R2_SECRET_ACCESS_KEY },
});
const exists = await storage.send(new HeadBucketCommand({ Bucket: environment.R2_BUCKET })).then(
  () => true,
  () => false,
);
if (!exists) await storage.send(new CreateBucketCommand({ Bucket: environment.R2_BUCKET }));

execFileSync("npx", ["tsx", "scripts/seed.ts"], {
  stdio: "inherit",
  env: { ...process.env, ...environment, DATABASE_OWNER_URL: urlFor(null, null, database) },
});
