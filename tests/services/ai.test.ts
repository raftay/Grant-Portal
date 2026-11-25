import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ids as i } from "../helpers/fixtures";
import { prepareServices } from "../helpers/services";

let env: Awaited<ReturnType<typeof prepareServices>>;
let ai: typeof import("@/server/services/ai");
let files: typeof import("@/server/services/files");
let documents: typeof import("@/server/services/documents");
let server: Server;

type Reply = { status?: number; stop?: string; text?: string; tokens?: number };
let reply: Reply = {};
let requests: { path: string; body: Record<string, never> & { [key: string]: unknown } }[] = [];

const staff = { userId: i.staff };
const pdf = Buffer.from("%PDF-1.7\nfictional");
const dates = { expires_on: { value: "2030-06-30", evidence: "Expires June 30, 2030", page: 1 }, review_on: null };
const contract = {
  funder_name: { value: "Evergreen Foundation", evidence: "Evergreen Foundation", page: 1 },
  award_number: null,
  award_amount: { value: "150000.10", evidence: "$150,000.10", page: 1 },
  starts_on: { value: "2026-01-01", evidence: "January 1, 2026", page: 1 },
  ends_on: { value: "2026-12-31", evidence: "December 31, 2026", page: 1 },
  deadlines: [
    { title: "Quarterly report", type: "report", due_on: "2026-11-30", evidence: "due on 30 November", page: 2 },
    { title: "Workshop summary", type: "deliverable", due_on: "2026-12-15", evidence: "by 15 December", page: 2 },
  ],
};
const details = { title: "Insurance", category: "insurance" as const, expiresOn: "2030-06-30", reviewOn: "", ownerId: i.staff, notes: "" };

beforeAll(async () => {
  server = createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      const path = request.url!.split("?")[0]!;
      requests.push({ path, body: JSON.parse(raw) });
      response.setHeader("content-type", "application/json");
      if (path.endsWith("count_tokens")) return response.end(JSON.stringify({ input_tokens: reply.tokens ?? 900 }));
      response.statusCode = reply.status ?? 200;
      response.end(
        JSON.stringify(
          reply.status
            ? { type: "error", error: { type: "api_error", message: "down" } }
            : {
                id: "msg_1",
                type: "message",
                role: "assistant",
                model: "claude-haiku-5-5",
                content: [
                  { type: "thinking", thinking: "", signature: "s" },
                  { type: "text", text: reply.text },
                ],
                stop_reason: reply.stop ?? "end_turn",
                stop_sequence: null,
                usage: { input_tokens: 900, output_tokens: 50 },
              },
        ),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  env = await prepareServices({ ANTHROPIC_BASE_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
  ai = await import("@/server/services/ai");
  files = await import("@/server/services/files");
  documents = await import("@/server/services/documents");
});
afterAll(async () => {
  server.close();
  await env.close();
});
beforeEach(async () => {
  requests = [];
  reply = { text: JSON.stringify(dates) };
  await env.query("update ai_extractions set created_at = now() - interval '2 days'");
});

async function upload(type: "application/pdf" | "image/png" = "application/pdf"): Promise<string> {
  const body = type === "application/pdf" ? pdf : Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
  const made = await files.createUpload(staff, { name: "a", mimeType: type, sizeBytes: body.byteLength });
  await fetch(made.url, { method: "PUT", body: new Uint8Array(body), headers: made.headers });
  await files.finalizeUpload(staff, made.fileId);
  return made.fileId;
}

const newest = async () =>
  (await env.query<{ id: string; status: string; error: string | null }>("select id, status, error from ai_extractions order by created_at desc limit 1"))[0]!;

describe("reading a document", () => {
  it("stores pending proposals with evidence and saves nothing else", async () => {
    const fileId = await upload();
    const documentId = await documents.createDocument(staff, { ...details, expiresOn: "", grantId: null, fileId });
    const id = await ai.readDocumentDates(staff, fileId);
    const extraction = await ai.getExtraction(staff, id);
    expect(extraction).toMatchObject({ status: "proposed", inputTokens: 900, outputTokens: 50, requestedBy: i.staff });
    expect(extraction.proposals).toMatchObject([
      { targetField: "expiresOn", proposedValue: "2030-06-30", evidence: "Expires June 30, 2030", pageNo: 1, status: "pending" },
    ]);
    expect((await documents.getDocument(staff, documentId)).expiresOn).toBeNull();
  });

  it("asks one small model for structured output only, without tools", async () => {
    await ai.readDocumentDates(staff, await upload());
    const body = requests.find((request) => request.path === "/v1/messages")!.body;
    expect(body).toMatchObject({ model: "claude-haiku-5-5", output_config: { effort: "low", format: { type: "json_schema" } } });
    expect(body).not.toHaveProperty("tools");
    expect(JSON.stringify(body)).not.toMatch(/example\.org|Sam|Alpha/);
  });

  it("sends images as images", async () => {
    await ai.readDocumentDates(staff, await upload("image/png"));
    expect(JSON.stringify(requests.at(-1)!.body)).toContain('"type":"image"');
  });

  it("accepts a document that states nothing", async () => {
    reply = { text: JSON.stringify({ expires_on: null, review_on: null }) };
    const id = await ai.readDocumentDates(staff, await upload());
    expect(await ai.getExtraction(staff, id)).toMatchObject({ status: "proposed", proposals: [] });
  });

  it.each<[string, Reply]>([
    ["a server error", { status: 500 }],
    ["overload", { status: 529 }],
    ["a bad key", { status: 401 }],
    ["a refusal", { stop: "refusal", text: JSON.stringify(dates) }],
    ["truncation", { stop: "max_tokens", text: '{"expires_on":' }],
    ["a complete answer cut off later", { stop: "max_tokens", text: JSON.stringify(dates) }],
    ["broken JSON", { text: "not json" }],
    ["a missing field", { text: JSON.stringify({ expires_on: null }) }],
    ["an impossible date", { text: JSON.stringify({ expires_on: { value: "2030-02-31", evidence: "x", page: 1 }, review_on: null }) }],
    ["a vague date", { text: JSON.stringify({ expires_on: { value: "June 2030", evidence: "x", page: 1 }, review_on: null }) }],
    ["a document that is too long", { tokens: 100_001, text: JSON.stringify(dates) }],
  ])("throws on %s, tries once, and records the failure", async (_label, bad) => {
    reply = bad;
    const fileId = await upload();
    await expect(ai.readDocumentDates(staff, fileId)).rejects.toThrow();
    expect(await newest()).toMatchObject({ status: "failed", error: expect.any(String) });
    expect(requests.filter((request) => request.path === "/v1/messages").length).toBeLessThanOrEqual(1);
    expect((await ai.getExtraction(staff, (await newest()).id)).proposals).toEqual([]);
    await documents.createDocument(staff, { ...details, grantId: null, fileId });
  });

  it("refuses viewers, payroll files, unsupported types and unfinished files", async () => {
    await expect(ai.readDocumentDates({ userId: i.viewer }, i.fileGeneral)).rejects.toMatchObject({ code: "forbidden" });
    for (const id of [i.filePayroll, i.filePending]) await expect(ai.readDocumentDates(staff, id)).rejects.toMatchObject({ code: "not_found" });
    await expect(ai.readDocumentDates({ userId: i.staffPay }, i.filePayroll)).rejects.toMatchObject({ code: "not_found" });
    await env.query("update files set mime_type = 'text/plain' where id = $1", [i.fileSpare]);
    await expect(ai.readDocumentDates(staff, i.fileSpare)).rejects.toMatchObject({ code: "invalid" });
    await expect(ai.getExtraction({ userId: i.viewer }, i.extraction)).rejects.toMatchObject({ code: "not_found" });
    expect(requests).toEqual([]);
  });

  it("stops at 20 a day for one person, even in parallel", async () => {
    await env.query("insert into ai_extractions (kind, model, prompt_version, requested_by) select 'document_dates', 'm', 'v', $1 from generate_series(1, 18)", [i.staff]);
    const fileId = await upload();
    const results = await Promise.allSettled([1, 2, 3, 4].map(() => ai.readDocumentDates(staff, fileId)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((result) => result.status === "rejected").every((result) => result.reason.code === "throttled")).toBe(true);
  });

  it("stops at 60 a day overall", async () => {
    await env.query("insert into ai_extractions (kind, model, prompt_version, requested_by) select 'document_dates', 'm', 'v', $1 from generate_series(1, 60)", [i.admin]);
    await expect(ai.readDocumentDates(staff, await upload())).rejects.toMatchObject({ code: "throttled" });
  });
});

describe("confirming a document", () => {
  async function ready() {
    const fileId = await upload();
    const documentId = await documents.createDocument(staff, { ...details, expiresOn: "", grantId: null, fileId });
    return { documentId, extractionId: await ai.readDocumentDates(staff, fileId) };
  }
  const outcome = async (id: string) => (await ai.getExtraction(staff, id)).proposals[0];

  it.each([
    ["2030-06-30", "accepted", "2030-06-30"],
    ["2030-07-01", "edited", "2030-07-01"],
    ["", "rejected", null],
  ])("saving %s marks the proposal %s", async (expiresOn, status, finalValue) => {
    const { documentId, extractionId } = await ready();
    await ai.confirmDocumentDates(staff, extractionId, documentId, { reviewed: true, document: { ...details, expiresOn } });
    expect(await outcome(extractionId)).toMatchObject({ status, finalValue, reviewedBy: i.staff });
    expect((await documents.getDocument(staff, documentId)).expiresOn).toBe(expiresOn === "" ? null : expiresOn);
    const log = await env.query("select actor_id from audit_log where action = 'approval.ai_reviewed' and entity_id = $1", [extractionId]);
    expect(log).toEqual([{ actor_id: i.staff }]);
  });

  it("needs the reviewed box, and works once", async () => {
    const { documentId, extractionId } = await ready();
    const input = { reviewed: true as const, document: details };
    expect(() => ai.confirmDocumentDates(staff, extractionId, documentId, { ...input, reviewed: false as never })).toThrow("reviewed");
    await expect(ai.confirmDocumentDates({ userId: i.viewer }, extractionId, documentId, input)).rejects.toMatchObject({ code: "forbidden" });
    await expect(ai.confirmDocumentDates(staff, extractionId, i.document, input)).rejects.toMatchObject({ code: "not_found" });
    await ai.confirmDocumentDates(staff, extractionId, documentId, input);
    await expect(ai.confirmDocumentDates(staff, extractionId, documentId, input)).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("contracts", () => {
  const award = { funderName: "Evergreen Foundation", awardNumber: "EV-9", awardCents: 15_000_010, startsOn: "2026-01-01", endsOn: "2026-12-30" };
  const row = { groupNo: 1, title: "Quarterly report", type: "report" as const, dueOn: "2026-11-30", ownerId: i.staff, reminderDays: 7 };

  beforeAll(async () => {
    const fileId = await upload();
    await documents.createDocument(staff, { ...details, category: "executed_contract", grantId: i.grantA, fileId });
  });
  beforeEach(() => {
    reply = { text: JSON.stringify(contract) };
  });

  it("proposes award details and deadlines, in exact cents", async () => {
    const extraction = await ai.getExtraction(staff, await ai.readContract(staff, i.grantA));
    const find = (group: number, field: string) => extraction.proposals.find((p) => p.groupNo === group && p.targetField === field)?.proposedValue;
    expect(find(0, "awardCents")).toBe(15_000_010);
    expect(find(0, "awardNumber")).toBeUndefined();
    expect(find(2, "dueOn")).toBe("2026-12-15");
    expect(await env.query("select 1 from deadlines where origin = 'ai_contract'")).toEqual([]);
  });

  it("applies only what was confirmed and records each decision", async () => {
    const id = await ai.readContract(staff, i.grantA);
    await ai.confirmContract(staff, id, { reviewed: true, award, deadlines: [row] });
    expect(await env.query("select award_cents, ends_on::text, award_number from grants where id = $1", [i.grantA])).toEqual([
      { award_cents: "15000010", ends_on: "2026-12-30", award_number: "EV-9" },
    ]);
    const saved = await env.query<{ id: string }>("select id from deadlines where origin = 'ai_contract' and grant_id = $1", [i.grantA]);
    expect(saved).toHaveLength(1);
    const statuses = Object.fromEntries((await ai.getExtraction(staff, id)).proposals.map((p) => [`${p.groupNo}.${p.targetField}`, p.status]));
    expect(statuses).toEqual({
      "0.funderName": "accepted",
      "0.awardCents": "accepted",
      "0.startsOn": "accepted",
      "0.endsOn": "edited",
      "1.title": "accepted",
      "1.type": "accepted",
      "1.dueOn": "accepted",
      "2.title": "rejected",
      "2.type": "rejected",
      "2.dueOn": "rejected",
    });
  });

  it("saves nothing if any part is wrong", async () => {
    const id = await ai.readContract(staff, i.grantA);
    const before = await env.query("select * from grants where id = $1", [i.grantA]);
    const base = { reviewed: true as const, award: { ...award, funderName: "Changed" } };
    await expect(ai.confirmContract(staff, id, { ...base, deadlines: [row, { ...row, groupNo: 9 }] })).rejects.toMatchObject({ code: "invalid" });
    await expect(ai.confirmContract(staff, id, { ...base, deadlines: [{ ...row, ownerId: i.deactivated }] })).rejects.toMatchObject({ code: "invalid" });
    expect(() => ai.confirmContract(staff, id, { ...base, deadlines: [row, row] })).toThrow("twice");
    expect(() => ai.confirmContract(staff, id, { ...base, award: { ...award, endsOn: "2025-01-01" }, deadlines: [] })).toThrow();
    expect(await env.query("select * from grants where id = $1", [i.grantA])).toEqual(before);
    expect((await ai.getExtraction(staff, id)).status).toBe("proposed");
  });

  it("is applied once when confirmed twice at the same time", async () => {
    const id = await ai.readContract(staff, i.grantA);
    const input = { reviewed: true as const, award, deadlines: [row] };
    const results = await Promise.allSettled([ai.confirmContract(staff, id, input), ai.confirmContract(staff, id, input)]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
  });

  it("throws without a contract, or on a backwards period", async () => {
    await expect(ai.readContract(staff, i.grantB)).rejects.toMatchObject({ code: "not_found" });
    reply = { text: JSON.stringify({ ...contract, ends_on: { value: "2025-01-01", evidence: "x", page: 1 } }) };
    await expect(ai.readContract(staff, i.grantA)).rejects.toThrow("ends before it starts");
  });
});
