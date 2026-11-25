import { createHash, randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Client } from "pg";
import { addDays, todayIn } from "../src/lib/dates";
import { formatLongDay } from "../src/lib/format";
import { hashPassword } from "../src/server/auth/password";
import { documents, grants, people, type Person } from "../seed/data";
import { makePdf } from "../seed/pdf";

const { DATABASE_OWNER_URL, SEED_PASSWORD, R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!DATABASE_OWNER_URL || !R2_ENDPOINT || !R2_BUCKET || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("Database and storage settings are required");
if (!SEED_PASSWORD || SEED_PASSWORD.length < 12) throw new Error("SEED_PASSWORD needs at least 12 characters");

const timeZone = "America/Los_Angeles";
const today = todayIn(timeZone);
const year = today.slice(0, 4);
const storage = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: "WHEN_REQUIRED",
});
const db = new Client({ connectionString: DATABASE_OWNER_URL });
await db.connect();

const existing = await db.query("select 1 from users limit 1");
if (existing.rowCount) throw new Error("This database already has users; reset it before seeding");

async function insert(table: string, values: Record<string, unknown>): Promise<string> {
  const names = Object.keys(values);
  const result = await db.query(
    `insert into ${table} (${names.join(", ")}) values (${names.map((_, index) => `$${index + 1}`).join(", ")}) returning id`,
    Object.values(values),
  );
  return result.rows[0].id;
}

const act = (userId: string) => db.query("select set_config('app.user_id', $1, true)", [userId]);

async function saveFile(name: string, bytes: Buffer): Promise<string> {
  const key = `general/${randomUUID()}.pdf`;
  await storage.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: "application/pdf" }));
  return insert("files", {
    storage_key: key,
    original_name: name,
    mime_type: "application/pdf",
    size_bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    status: "ready",
    ready_at: new Date(),
  });
}

async function saveDocument(values: Record<string, unknown>, fileName: string, bytes: Buffer): Promise<void> {
  const fileId = await saveFile(fileName, bytes);
  const documentId = await insert("documents", values);
  await insert("document_versions", { document_id: documentId, version_no: 1, file_id: fileId });
}

await db.query("begin");
const ids = {} as Record<Person, string>;
const passwordHash = await hashPassword(SEED_PASSWORD);
for (const person of people) {
  ids[person.key] = await insert("users", {
    name: person.name,
    email: person.email,
    role: person.role,
    status: "active",
    can_view_payroll: person.payroll,
    email_verified: new Date(),
  });
  await act(ids.alex);
  await db.query("insert into user_credentials (user_id, password_hash) values ($1, $2)", [ids[person.key], passwordHash]);
}

await insert("organization_profile", {
  legal_name: "Harbor Community Initiative",
  ein: "00-0000000",
  address_line1: "125 Harbor Way",
  city: "Portland",
  state: "OR",
  postal_code: "97201",
  fiscal_year_start_month: 1,
  fiscal_year_start_day: 1,
  signer_name: "Alex Morgan",
  signer_title: "Executive Director",
  signer_email: "alex@example.org",
  timezone: timeZone,
});

for (const [index, grant] of grants.entries()) {
  await act(ids[grant.owner]);
  const code = `${grant.code}-${year}`;
  const startsOn = `${year}-01-01`;
  const endsOn = `${year}-12-31`;
  const grantId = await insert("grants", {
    name: grant.name,
    code,
    funder_name: grant.funder,
    award_number: `${code}-${String(14 + index).padStart(3, "0")}`,
    award_cents: grant.dollars * 100,
    awarded_on: startsOn,
    starts_on: startsOn,
    ends_on: endsOn,
    owner_id: ids[grant.owner],
    status: "active",
    purpose: grant.purpose,
    sort_order: index + 1,
  });
  await insert("grant_contacts", { grant_id: grantId, agency: grant.funder, is_primary: true, ...grant.contact });
  await insert("grant_links", { grant_id: grantId, label: "Open funder portal", url: `https://example.org/funders/${grant.code.toLowerCase()}` });
  for (const deadline of grant.deadlines) {
    await insert("deadlines", {
      grant_id: grantId,
      type: deadline.type,
      title: deadline.title,
      due_on: addDays(today, deadline.days),
      owner_id: ids[deadline.owner],
      status: deadline.status === undefined ? "open" : deadline.status,
      reminder_days: 7,
    });
  }
  if (index < 2) {
    const reports = grant.deadlines.map((deadline) => `${deadline.title} is due on ${formatLongDay(addDays(today, deadline.days))}.`);
    const contract = makePdf("GRANT AGREEMENT", [
      [grant.funder, "", "1. Award", `The Funder awards Harbor Community Initiative $${grant.dollars.toLocaleString("en-US")}.00`, `for ${grant.name}. Award number ${code}-${String(14 + index).padStart(3, "0")}.`],
      ["2. Grant period", `The grant period begins on ${formatLongDay(startsOn)}`, `and ends on ${formatLongDay(endsOn)}.`, "", "3. Reporting", ...reports],
    ]);
    await saveDocument({ grant_id: grantId, title: "Executed contract", category: "executed_contract", owner_id: ids[grant.owner] }, `${code}_executed-contract.pdf`, contract);
  }
}

for (const document of documents) {
  await act(ids[document.owner]);
  const dates = [
    document.expires === null ? "" : `This certificate expires on ${formatLongDay(addDays(today, document.expires))}.`,
    document.review === null ? "" : `Next review date: ${formatLongDay(addDays(today, document.review))}.`,
  ].filter(Boolean);
  await saveDocument(
    {
      title: document.title,
      category: document.category,
      owner_id: ids[document.owner],
      expires_on: document.expires === null ? null : addDays(today, document.expires),
      review_on: document.review === null ? null : addDays(today, document.review),
    },
    `${document.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`,
    makePdf(document.title, [[...document.lines, ...dates]]),
  );
}
await db.query("commit");
await db.end();
console.log(`Seeded ${people.length} people, ${grants.length} grants and ${documents.length} organisation documents for ${today}`);
