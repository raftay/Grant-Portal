import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, deadlineState, todayIn } from "@/lib/dates";
import { ids as i } from "../helpers/fixtures";
import { prepareServices } from "../helpers/services";

let env: Awaited<ReturnType<typeof prepareServices>>;
let grants: typeof import("@/server/services/grants");
let deadlines: typeof import("@/server/services/deadlines");
let overview: typeof import("@/server/services/overview");

const staff = { userId: i.staff };
const viewer = { userId: i.viewer };
const admin = { userId: i.admin };
const today = todayIn("America/New_York");

const grant = {
  name: "Youth pathways",
  code: "YP",
  funderName: "Harbor Fund",
  awardNumber: "H-1",
  awardCents: 12_345_678,
  startsOn: "2026-01-01",
  endsOn: "2026-12-31",
  purpose: "After-school programs",
  awardedOn: "",
  ownerId: i.staff,
  status: "active" as const,
  termsText: "",
  sortOrder: 1,
};
const contact = { name: "Ola", title: "Officer", agency: "Harbor", email: "OLA@example.org", phone: "", isPrimary: true };
const deadline = {
  grantId: i.grantA,
  type: "report" as const,
  title: "Q2 report",
  description: "",
  dueOn: addDays(today, 5),
  ownerId: i.staff,
  status: "open" as const,
  reminderDays: 14,
};

beforeAll(async () => {
  env = await prepareServices();
  grants = await import("@/server/services/grants");
  deadlines = await import("@/server/services/deadlines");
  overview = await import("@/server/services/overview");
});
afterAll(() => env.close());

describe("grants", () => {
  it("creates, reads and updates", async () => {
    const id = await grants.createGrant(staff, grant);
    expect(await grants.getGrant(viewer, id)).toMatchObject({
      awardCents: 12_345_678,
      ownerName: "Sam",
      purpose: "After-school programs",
      contract: undefined,
      spending: { available: false },
    });
    await grants.updateGrant(staff, id, { ...grant, name: "Renamed" });
    expect((await grants.listGrants(viewer)).find((row) => row.id === id)).toMatchObject({ name: "Renamed", nextDeadlineOn: null });
  });

  it("reports the next open deadline of the right grant", async () => {
    await deadlines.createDeadline(staff, { ...deadline, grantId: i.grantB, title: "Later", dueOn: "2031-02-02" });
    await deadlines.createDeadline(staff, { ...deadline, grantId: i.grantB, title: "Done", dueOn: "2030-01-01", status: "completed" });
    const rows = await grants.listGrants(viewer);
    expect(rows.find((row) => row.id === i.grantB)?.nextDeadlineOn).toBe("2031-02-02");
    expect(rows.find((row) => row.id === i.grantA)?.nextDeadlineOn).toBe("2026-04-01");
    expect((await grants.getGrant(viewer, i.grantB)).nextDeadlineOn).toBe("2031-02-02");
  });

  it("rejects bad input", async () => {
    for (const bad of [{ endsOn: "2025-01-01" }, { awardCents: -1 }, { awardCents: 1.5 }, { name: " " }]) {
      expect(() => grants.createGrant(staff, { ...grant, ...bad })).toThrow();
    }
    await expect(grants.createGrant(staff, { ...grant, code: "A" })).rejects.toMatchObject({ code: "conflict" });
    await expect(grants.createGrant(staff, { ...grant, code: "Z", ownerId: i.deactivated })).rejects.toMatchObject({ code: "invalid" });
    await expect(grants.updateGrant(staff, i.document, grant)).rejects.toMatchObject({ code: "not_found" });
  });

  it("keeps one primary contact", async () => {
    const first = await grants.addContact(staff, i.grantB, contact);
    const second = await grants.addContact(staff, i.grantB, { ...contact, name: "Bo" });
    const primary = async () => (await grants.getGrant(viewer, i.grantB)).contacts.filter((row) => row.isPrimary).map((row) => row.id);
    expect(await primary()).toEqual([second]);
    await grants.updateContact(staff, first, contact);
    expect(await primary()).toEqual([first]);
    await grants.removeContact(staff, first);
    expect(await primary()).toEqual([]);
    await expect(grants.removeContact(staff, first)).rejects.toMatchObject({ code: "not_found" });
  });

  it("manages https links only", async () => {
    const id = await grants.addLink(staff, i.grantB, { label: "Portal", url: "https://funder.example.org/a" });
    await grants.updateLink(staff, id, { label: "Portal 2", url: "https://funder.example.org/b" });
    expect((await grants.getGrant(viewer, i.grantB)).links).toMatchObject([{ label: "Portal 2" }]);
    for (const url of ["http://x.org", "javascript:alert(1)", "x"]) expect(() => grants.addLink(staff, i.grantB, { label: "x", url })).toThrow();
    await grants.removeLink(staff, id);
  });

  it("is read-only for viewers", async () => {
    for (const attempt of [
      () => grants.createGrant(viewer, { ...grant, code: "V" }),
      () => grants.updateGrant(viewer, i.grantA, grant),
      () => grants.addContact(viewer, i.grantA, contact),
      () => grants.updateContact(viewer, i.contact, contact),
      () => grants.removeContact(viewer, i.contact),
      () => grants.addLink(viewer, i.grantA, { label: "x", url: "https://x.org" }),
      () => grants.removeLink(viewer, i.link),
      () => deadlines.createDeadline(viewer, deadline),
      () => deadlines.updateDeadline(viewer, i.deadline, deadline),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ code: "forbidden" });
    }
  });
});

describe("deadlines", () => {
  it("records who completed it, keeps that on later edits, and clears it on reopening", async () => {
    const id = await deadlines.createDeadline(staff, deadline);
    const read = async () => (await env.query<{ completed_by: string; completed_at: Date }>("select completed_by, completed_at from deadlines where id = $1", [id]))[0]!;
    await deadlines.updateDeadline(staff, id, { ...deadline, status: "completed" });
    const done = await read();
    expect(done.completed_by).toBe(i.staff);
    await deadlines.updateDeadline(admin, id, { ...deadline, title: "Edited", status: "completed" });
    expect(await read()).toEqual(done);
    await deadlines.updateDeadline(admin, id, deadline);
    expect(await read()).toEqual({ completed_by: null, completed_at: null });
  });

  it("filters", async () => {
    const mine = await deadlines.listDeadlines(viewer, { ownerId: i.staff, grantId: i.grantA, type: "report", status: "open" });
    expect(mine.map((row) => row.title)).toEqual(["Q2 report"]);
    expect(await deadlines.listDeadlines(viewer, { type: "contract_expiry" })).toEqual([]);
    expect(() => deadlines.listDeadlines(viewer, { grantId: "x" })).toThrow();
  });

  it.each([
    ["open", -1, "overdue"],
    ["open", 0, "due_soon"],
    ["in_progress", 30, "due_soon"],
    ["open", 31, "upcoming"],
    ["completed", -9, "done"],
    ["waived", -9, "done"],
  ])("%s at %i days is %s", (status, offset, state) => {
    expect(deadlineState({ status, dueOn: addDays(today, offset), reminderDays: 7 }, today)).toBe(state);
  });
});

describe("overview", () => {
  it("lists what needs attention, soonest first, and nothing else", async () => {
    await env.query("update documents set expires_on = $1 where id = $2", [addDays(today, -1), i.document]);
    await env.query("insert into documents (title, category, review_on) values ('Review soon', 'policy', $1), ('Far', 'policy', $2)", [
      addDays(today, 30),
      addDays(today, 31),
    ]);
    await env.query("insert into documents (title, category, expires_on, archived_at) values ('Archived', 'policy', $1, now())", [today]);
    const items = await overview.listAttention(viewer);
    expect(items.map((row) => [row.title, row.state])).toEqual([
      ["Q1", "overdue"],
      ["W-9", "expired"],
      ["Q2 report", "due_soon"],
      ["Review soon", "review_due"],
    ]);
  });

  it("summarises without inventing spending", async () => {
    expect(await overview.getSummary(viewer)).toMatchObject({
      activeGrants: 3,
      awardedCents: 100_000 + 50_000 + 12_345_678,
      deadlinesWithin30Days: 2,
      spending: { available: false },
    });
  });

  it("shows activity to everyone and the full log to admins only", async () => {
    expect((await overview.listActivity(viewer, 5)).length).toBe(5);
    expect((await overview.listAudit(admin, { entityType: "grants" })).every((row) => row.entityType === "grants")).toBe(true);
    for (const call of [overview.listAudit, overview.listAccessChanges, overview.listEmails] as ((id: typeof staff, f: object) => Promise<unknown>)[]) {
      await expect(call(staff, {})).rejects.toMatchObject({ code: "forbidden" });
    }
    const [latest] = await overview.listAudit(admin, {});
    const older = await overview.listAudit(admin, { before: latest!.id });
    expect(older.every((row) => row.id < latest!.id)).toBe(true);
  });
});
