import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ids as i } from "../helpers/fixtures";
import { prepareServices } from "../helpers/services";

let env: Awaited<ReturnType<typeof prepareServices>>;
let daily: typeof import("@/server/jobs/daily");
let alerts: typeof import("@/server/services/alerts");
let route: typeof import("@/app/api/cron/daily/route");

const noon = (day: string) => new Date(`${day}T17:00:00Z`);
let status = 200;
const sent: { to: string; subject: string; key: string }[] = [];

beforeAll(async () => {
  env = await prepareServices({ EMAIL_MODE: "resend", RESEND_API_KEY: "test" });
  await env.query("update users set status = 'deactivated' where id = $1", [i.viewerPay]);
  vi.stubGlobal("fetch", async (_url: string, init: { body: string; headers: Record<string, string> }) => {
    const body = JSON.parse(init.body) as { to: string; subject: string };
    if (status === 200) sent.push({ to: body.to, subject: body.subject, key: init.headers["idempotency-key"]! });
    return new Response(JSON.stringify({ id: "m1" }), { status });
  });
  daily = await import("@/server/jobs/daily");
  alerts = await import("@/server/services/alerts");
  route = await import("@/app/api/cron/daily/route");
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await env.close();
});
beforeEach(async () => {
  status = 200;
  sent.length = 0;
  await env.query("delete from notifications");
  await env.query("update deadlines set status = 'waived', due_on = '2026-04-01', owner_id = null");
  await env.query("update documents set expires_on = null, review_on = null, owner_id = $1, archived_at = null", [i.staff]);
});
afterEach(() => env.query("update users set status = 'active' where id = $1", [i.staff]));

const expiry = (day: string) => env.query("update documents set expires_on = $1 where id = $2", [day, i.document]);
const due = (day: string, reminder: number, owner: string | null = i.staff) =>
  env.query("update deadlines set status = 'open', due_on = $1, reminder_days = $2, owner_id = $3 where id = $4", [day, reminder, owner, i.deadline]);

describe("daily alerts", () => {
  it.each([
    ["2026-03-01", 0],
    ["2026-03-02", 1],
    ["2026-03-20", 1],
    ["2026-04-01", 1],
  ])("document expiring 2026-04-01, run on %s, sends %i", async (day, n) => {
    await expiry("2026-04-01");
    expect((await daily.runDaily(noon(day))).sent).toBe(n);
  });

  it("sends 30-day and overdue once each, and never twice", async () => {
    await expiry("2026-04-01");
    for (const day of ["2026-03-02", "2026-03-03", "2026-04-02", "2026-04-03", "2026-06-01"]) await daily.runDaily(noon(day));
    expect(sent.map((mail) => mail.subject)).toEqual(["Reminder: W-9", "Overdue: W-9"]);
    expect(sent[0]).toMatchObject({ to: "sam@example.org" });
  });

  it("alerts again when the date changes", async () => {
    await expiry("2026-04-01");
    await daily.runDaily(noon("2026-03-10"));
    await expiry("2026-04-05");
    expect((await daily.runDaily(noon("2026-03-10"))).sent).toBe(1);
  });

  it("covers review dates separately from expiry", async () => {
    await env.query("update documents set expires_on = '2026-04-01', review_on = '2026-03-20' where id = $1", [i.document]);
    expect((await daily.runDaily(noon("2026-03-25"))).sent).toBe(2);
    expect(sent.map((mail) => mail.subject).sort()).toEqual(["Overdue: W-9", "Reminder: W-9"]);
  });

  it("uses the organisation's midnight", async () => {
    await expiry("2026-04-01");
    expect((await daily.runDaily(new Date("2026-03-02T04:30:00Z"))).sent).toBe(0);
    expect((await daily.runDaily(new Date("2026-03-02T05:30:00Z"))).sent).toBe(1);
  });

  it("follows each deadline's own reminder", async () => {
    await due("2026-06-30", 45);
    expect((await daily.runDaily(noon("2026-05-15"))).sent).toBe(0);
    expect((await daily.runDaily(noon("2026-05-16"))).sent).toBe(1);
    expect((await daily.runDaily(noon("2026-06-30"))).sent).toBe(0);
    expect((await daily.runDaily(noon("2026-07-01"))).sent).toBe(1);
    expect(sent.map((mail) => mail.subject)).toEqual(["Reminder: Q1 (Alpha)", "Overdue: Q1 (Alpha)"]);
  });

  it("skips finished, archived, unowned and deactivated-owner items", async () => {
    await due("2026-04-01", 7, null);
    await expiry("2026-04-01");
    await env.query("update documents set archived_at = now()");
    expect((await daily.runDaily(noon("2026-03-30"))).sent).toBe(0);
    await env.query("update documents set archived_at = null");
    await env.query("update users set status = 'deactivated' where id = $1", [i.staff]);
    expect((await daily.runDaily(noon("2026-03-30"))).sent).toBe(0);
  });

  it("throws when email fails, records it, and leaves the alert unsent", async () => {
    await expiry("2026-04-01");
    status = 500;
    await expect(daily.runDaily(noon("2026-03-10"))).rejects.toThrow("Resend returned 500");
    expect(await env.query("select 1 from notifications")).toEqual([]);
    expect((await env.query<{ status: string }>("select status from email_messages order by created_at desc limit 1"))[0]!.status).toBe("failed");
    status = 200;
    expect((await daily.runDaily(noon("2026-03-11"))).sent).toBe(1);
  });

  it("does not double-send when two runs overlap", async () => {
    await expiry("2026-04-01");
    const runs = await Promise.all([daily.runDaily(noon("2026-03-10")), daily.runDaily(noon("2026-03-10"))]);
    expect(runs.map((run) => run.sent).sort()).toEqual([0, 1]);
    expect(sent).toHaveLength(1);
  });

  it("discards uploads left unfinished for a day", async () => {
    await env.query("alter table files disable trigger a_stamp");
    await env.query("update files set created_at = now() - interval '2 days' where id = $1", [i.filePending]);
    expect((await daily.runDaily(new Date())).uploadsDiscarded).toBe(1);
    expect((await env.query<{ status: string }>("select status from files where id = $1", [i.filePending]))[0]!.status).toBe("failed");
  });
});

describe("running it", () => {
  const call = (authorization?: string) =>
    route.GET(new Request("https://portal.example.org/api/cron/daily", { headers: authorization ? { authorization } : {} }));

  it("needs the secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call(`Bearer ${process.env.CRON_SECRET}`)).status).toBe(200);
  });

  it("lets admins run it by hand, and logs who did", async () => {
    await expect(alerts.runAlertsNow({ userId: i.staff })).rejects.toMatchObject({ code: "forbidden" });
    await alerts.runAlertsNow({ userId: i.admin });
    const rows = await env.query("select action, actor_id from audit_log where action like 'job.%' order by id desc limit 2");
    expect(rows).toEqual([
      { action: "job.daily_completed", actor_id: null },
      { action: "job.daily_requested", actor_id: i.admin },
    ]);
  });
});
