import { addDays, todayIn } from "../src/lib/dates";
import { formatLongDay } from "../src/lib/format";
import { documents, grants, people, type Person } from "./data";
import { makePdf } from "./pdf";

export type SeedTools = {
  query: (text: string, values: unknown[]) => Promise<{ id: string }[]>;
  store: (key: string, bytes: Uint8Array) => Promise<void>;
  hashPassword: (password: string) => Promise<string>;
  sha256: (bytes: Uint8Array) => Promise<string>;
  passwordFor: (person: Person) => string;
};

const timeZone = "America/Los_Angeles";

export async function loadSeed({ query, store, hashPassword, sha256, passwordFor }: SeedTools): Promise<string> {
  const today = todayIn(timeZone);
  const year = today.slice(0, 4);
  const existing = await query("select id::text as id from users limit 1", []);
  if (existing.length > 0) throw new Error("This database already has users; reset it before seeding");

  async function insert(table: string, values: Record<string, unknown>): Promise<string> {
    const names = Object.keys(values);
    const rows = await query(
      `insert into ${table} (${names.join(", ")}) values (${names.map((_, index) => `$${index + 1}`).join(", ")}) returning id`,
      Object.values(values),
    );
    const [row] = rows;
    if (!row) throw new Error(`Nothing was inserted into ${table}`);
    return row.id;
  }

  const act = (userId: string) => query("select set_config('app.user_id', $1, true)", [userId]);

  async function saveFile(name: string, bytes: Uint8Array): Promise<string> {
    const key = `general/${crypto.randomUUID()}.pdf`;
    await store(key, bytes);
    return insert("files", {
      storage_key: key,
      original_name: name,
      mime_type: "application/pdf",
      size_bytes: bytes.byteLength,
      sha256: await sha256(bytes),
      status: "ready",
      ready_at: new Date().toISOString(),
    });
  }

  async function saveDocument(values: Record<string, unknown>, fileName: string, bytes: Uint8Array): Promise<void> {
    const fileId = await saveFile(fileName, bytes);
    const documentId = await insert("documents", values);
    await insert("document_versions", { document_id: documentId, version_no: 1, file_id: fileId });
  }

  const ids = {} as Record<Person, string>;
  for (const person of people) {
    ids[person.key] = await insert("users", {
      name: person.name,
      email: person.email,
      role: person.role,
      status: "active",
      can_view_payroll: person.payroll,
      email_verified: new Date().toISOString(),
    });
    await act(ids.alex);
    await query("insert into user_credentials (user_id, password_hash) values ($1, $2)", [ids[person.key], await hashPassword(passwordFor(person.key))]);
  }

  await query(
    `insert into organization_profile (legal_name, ein, address_line1, city, state, postal_code, signer_name, signer_title, signer_email, timezone)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    ["Harbor Community Initiative", "00-0000000", "125 Harbor Way", "Portland", "OR", "97201", "Alex Morgan", "Executive Director", "alex@example.org", timeZone],
  );

  for (const [index, grant] of grants.entries()) {
    await act(ids[grant.owner]);
    const code = `${grant.code}-${year}`;
    const awardNumber = `${code}-${String(14 + index).padStart(3, "0")}`;
    const startsOn = `${year}-01-01`;
    const endsOn = `${year}-12-31`;
    const grantId = await insert("grants", {
      name: grant.name,
      code,
      funder_name: grant.funder,
      award_number: awardNumber,
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
        [grant.funder, "", "1. Award", `The Funder awards Harbor Community Initiative $${grant.dollars.toLocaleString("en-US")}.00`, `for ${grant.name}. Award number ${awardNumber}.`],
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
  return `Seeded ${people.length} people, ${grants.length} grants and ${documents.length} organisation documents for ${today}`;
}
