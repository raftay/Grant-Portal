import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { documentState, todayIn } from "@/lib/dates";
import { ids as i } from "../helpers/fixtures";
import { prepareServices } from "../helpers/services";

let env: Awaited<ReturnType<typeof prepareServices>>;
let files: typeof import("@/server/services/files");
let documents: typeof import("@/server/services/documents");
let organization: typeof import("@/server/services/organization");

const staff = { userId: i.staff };
const viewer = { userId: i.viewer };
const pdf = Buffer.from("%PDF-1.7\nfictional");
const details = { title: "Policy", category: "policy" as const, expiresOn: "2030-01-01", reviewOn: "", ownerId: i.staff, notes: "" };

beforeAll(async () => {
  env = await prepareServices();
  files = await import("@/server/services/files");
  documents = await import("@/server/services/documents");
  organization = await import("@/server/services/organization");
});
afterAll(() => env.close());

const describeUpload = (body: Buffer, mimeType = "application/pdf", sensitivity: "general" | "payroll" = "general") => ({
  name: "Policy “final”.pdf",
  mimeType: mimeType as "application/pdf",
  sizeBytes: body.byteLength,
  sensitivity,
});
const put = (url: string, body: Buffer, type = "application/pdf") =>
  fetch(url, { method: "PUT", body: new Uint8Array(body), headers: { "content-type": type } });

async function upload(identity = staff, body = pdf): Promise<string> {
  const { fileId, url } = await files.createUpload(identity, describeUpload(body));
  expect((await put(url, body)).status).toBe(200);
  await files.finalizeUpload(identity, fileId);
  return fileId;
}

describe("uploads", () => {
  it("stores, verifies, logs and serves a file through short-lived links", async () => {
    const fileId = await upload();
    const url = await files.openFile(viewer, fileId, "view");
    expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe("60");
    const response = await fetch(url);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
    expect(response.headers.get("content-disposition")).toContain("inline");
    const actions = await env.query<{ action: string; actor_id: string }>(
      "select action, actor_id from audit_log where entity_id = $1 and action like 'file.%' order by id",
      [fileId],
    );
    expect(actions).toEqual([
      { action: "file.uploaded", actor_id: i.staff },
      { action: "file.viewed", actor_id: i.viewer },
    ]);
  });

  it("is private without a signature", async () => {
    const fileId = await upload();
    const url = new URL(await files.openFile(staff, fileId, "download"));
    url.search = "";
    expect((await fetch(url)).status).toBeGreaterThanOrEqual(400);
  });

  it("refuses a different size or type at the store", async () => {
    const { url } = await files.createUpload(staff, describeUpload(pdf));
    expect((await put(url, pdf, "text/html")).status).toBe(403);
    expect((await put(url, Buffer.concat([pdf, pdf]))).status).toBe(403);
  });

  it("rejects contents that do not match the type and removes them", async () => {
    const body = Buffer.from("<script>alert(1)</script>");
    const { fileId, url } = await files.createUpload(staff, describeUpload(body));
    await put(url, body);
    await expect(files.finalizeUpload(staff, fileId)).rejects.toMatchObject({ code: "invalid" });
    expect(await env.query("select status from files where id = $1", [fileId])).toEqual([{ status: "failed" }]);
    await expect(files.openFile(staff, fileId, "view")).rejects.toMatchObject({ code: "not_found" });
  });

  it("keeps the verified copy if the upload link is reused", async () => {
    const { fileId, url } = await files.createUpload(staff, describeUpload(pdf));
    await put(url, pdf);
    await files.finalizeUpload(staff, fileId);
    await put(url, Buffer.from("%PDF-1.7\nswapped!!"));
    const served = await fetch(await files.openFile(staff, fileId, "download"));
    expect(Buffer.from(await served.arrayBuffer())).toEqual(pdf);
  });

  it("cannot be finished early, twice or by someone else", async () => {
    const { fileId, url } = await files.createUpload(staff, describeUpload(pdf));
    await expect(files.finalizeUpload(staff, fileId)).rejects.toThrow();
    await put(url, pdf);
    await expect(files.finalizeUpload({ userId: i.admin }, fileId)).rejects.toMatchObject({ code: "not_found" });
    await files.finalizeUpload(staff, fileId);
    await expect(files.finalizeUpload(staff, fileId)).rejects.toMatchObject({ code: "not_found" });
  });

  it("validates type, size and role", async () => {
    await expect(files.createUpload(staff, describeUpload(pdf, "text/html"))).rejects.toThrow("Upload a PDF");
    await expect(files.createUpload(staff, { ...describeUpload(pdf), sizeBytes: 15 * 1024 * 1024 + 1 })).rejects.toThrow("15 MB");
    await expect(files.createUpload(viewer, describeUpload(pdf))).rejects.toMatchObject({ code: "forbidden" });
    await expect(files.createUpload(staff, describeUpload(pdf, "application/pdf", "payroll"))).rejects.toMatchObject({ code: "forbidden" });
  });

  it("hides payroll files from people without access", async () => {
    await expect(files.openFile(staff, i.filePayroll, "view")).rejects.toMatchObject({ code: "not_found" });
    await expect(files.openFile({ userId: i.admin }, i.filePayroll, "view")).rejects.toMatchObject({ code: "not_found" });
    expect(await files.openFile({ userId: i.viewerPay }, i.filePayroll, "view")).toContain("X-Amz-Signature");
  });
});

describe("documents", () => {
  it("creates, lists, replaces and archives", async () => {
    const id = await documents.createDocument(staff, { ...details, grantId: null, fileId: await upload() });
    const listed = (await documents.listDocuments(viewer, { grantId: null })).find((row) => row.id === id);
    expect(listed).toMatchObject({ title: "Policy", versionNo: 1, ownerName: "Sam", state: "current", reviewOn: null });
    const second = await upload();
    expect(await documents.replaceDocumentFile(staff, id, second)).toBe(2);
    const detail = await documents.getDocument(viewer, id);
    expect(detail.versions.map((v) => v.versionNo)).toEqual([2, 1]);
    expect((await documents.listDocuments(viewer, { grantId: null })).find((row) => row.id === id)?.fileId).toBe(second);
    await documents.archiveDocument(staff, id);
    expect((await documents.listDocuments(viewer, { grantId: null })).some((row) => row.id === id)).toBe(false);
    await expect(documents.replaceDocumentFile(staff, id, await upload())).rejects.toMatchObject({ code: "not_found" });
    await expect(documents.updateDocument(staff, id, details)).rejects.toMatchObject({ code: "not_found" });
  });

  it("keeps grant documents apart from organisation documents", async () => {
    const id = await documents.createDocument(staff, { ...details, grantId: i.grantA, fileId: await upload() });
    expect((await documents.listDocuments(viewer, { grantId: i.grantA })).map((row) => row.id)).toContain(id);
    expect((await documents.listDocuments(viewer, { grantId: null })).map((row) => row.id)).not.toContain(id);
  });

  it("numbers simultaneous replacements without clashing", async () => {
    const id = await documents.createDocument(staff, { ...details, grantId: null, fileId: await upload() });
    const uploads = await Promise.all([upload(), upload(), upload()]);
    const numbers = await Promise.all(uploads.map((fileId) => documents.replaceDocumentFile(staff, id, fileId)));
    expect(numbers.sort()).toEqual([2, 3, 4]);
  });

  it("refuses files that are unfinished, reused, payroll or another person's", async () => {
    const used = await upload();
    await documents.createDocument(staff, { ...details, grantId: null, fileId: used });
    const pending = (await files.createUpload(staff, describeUpload(pdf))).fileId;
    const others = await upload({ userId: i.admin });
    const make = (fileId: string) => documents.createDocument(staff, { ...details, grantId: null, fileId });
    await expect(make(used)).rejects.toMatchObject({ code: "conflict" });
    for (const fileId of [pending, others, i.filePayroll]) await expect(make(fileId)).rejects.toMatchObject({ code: "invalid" });
  });

  it("validates owner, dates and contract rules", async () => {
    const make = async (extra: object) => documents.createDocument(staff, { ...details, grantId: null, fileId: await upload(), ...extra });
    await expect(make({ ownerId: i.deactivated })).rejects.toMatchObject({ code: "invalid" });
    await expect(make({ expiresOn: "2026-02-30" })).rejects.toThrow();
    await expect(make({ category: "executed_contract" })).rejects.toMatchObject({ code: "invalid" });
    await make({ category: "executed_contract", grantId: i.grantB });
    await expect(make({ category: "executed_contract", grantId: i.grantB })).rejects.toMatchObject({ code: "conflict" });
  });

  it("is read-only for viewers and closed to deactivated people", async () => {
    await expect(documents.updateDocument(viewer, i.document, details)).rejects.toMatchObject({ code: "forbidden" });
    await expect(documents.archiveDocument(viewer, i.document)).rejects.toMatchObject({ code: "forbidden" });
    await expect(documents.listDocuments({ userId: i.deactivated }, { grantId: null })).rejects.toThrow();
    await expect(documents.getDocument({ userId: i.deactivated }, i.document)).rejects.toMatchObject({ code: "not_found" });
  });
});

describe("organisation", () => {
  const profile = { legalName: "Example Org", ein: "12-3456789", fiscalYearStartMonth: 7, fiscalYearStartDay: 1, timezone: "America/Chicago", city: " Springfield " };

  it("saves for staff, reads for viewers", async () => {
    expect(await organization.saveOrganization(staff, profile)).toMatchObject({ city: "Springfield", fiscalYearStartMonth: 7 });
    expect(await organization.getOrganization(viewer)).toMatchObject({ timezone: "America/Chicago", addressLine1: null });
    await expect(organization.saveOrganization(viewer, profile)).rejects.toMatchObject({ code: "forbidden" });
  });

  it.each([{ ein: "123456789" }, { timezone: "Mars/Olympus" }, { fiscalYearStartMonth: 2, fiscalYearStartDay: 30 }, { legalName: " " }, { signerEmail: "x" }])(
    "rejects %o",
    (bad) => {
      expect(() => organization.saveOrganization(staff, { ...profile, ...bad })).toThrow();
    },
  );
});

describe("dates", () => {
  it("uses the organisation's day, not the server's", () => {
    const instant = new Date("2026-03-01T04:30:00Z");
    expect(todayIn("America/New_York", instant)).toBe("2026-02-28");
    expect(todayIn("UTC", instant)).toBe("2026-03-01");
  });

  it.each([
    ["2026-02-28", null, "expired"],
    ["2026-03-01", null, "expiring"],
    ["2026-03-31", null, "expiring"],
    ["2026-04-01", null, "current"],
    [null, "2026-02-28", "review_overdue"],
    [null, "2026-03-31", "review_due"],
    ["2026-03-05", "2026-02-01", "review_overdue"],
    [null, null, "current"],
  ])("expiry %s and review %s is %s", (expiresOn, reviewOn, state) => {
    expect(documentState({ expiresOn, reviewOn }, "2026-03-01")).toBe(state);
  });
});
