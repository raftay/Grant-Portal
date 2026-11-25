import { createHash } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { hashPassword } from "../src/server/auth/password";
import { loadSeed } from "../seed/load";

const { DATABASE_OWNER_URL, SEED_PASSWORD, R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!DATABASE_OWNER_URL || !R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("Database and storage settings are required");
if (!SEED_PASSWORD || SEED_PASSWORD.length < 12) throw new Error("SEED_PASSWORD needs at least 12 characters");

const storage = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: "WHEN_REQUIRED",
});
const db = new Client({ connectionString: DATABASE_OWNER_URL });
await db.connect();
await db.query("begin");
const summary = await loadSeed({
  query: async (text, values) => (await db.query(text, values)).rows,
  store: async (key, bytes) => {
    await storage.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: "application/pdf" }));
  },
  hashPassword,
  sha256: async (bytes) => createHash("sha256").update(bytes).digest("hex"),
  passwordFor: () => SEED_PASSWORD,
});
await db.query("commit");
await db.end();
console.log(summary);
