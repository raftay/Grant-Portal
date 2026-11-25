import { afterAll, describe, expect, it } from "vitest";
import { ids as i } from "../helpers/fixtures";
import { asOwner, asSystem, asUser, closePools } from "../helpers/session";

afterAll(closePools);

describe("audit log", () => {
  it("records who, what, before and after", async () => {
    await asUser(i.admin, async (c) => {
      await c.query("select set_config('app.request_id', 'req-1', true)");
      await c.query("update grants set name = 'Renamed' where id = $1", [i.grantA]);
      const { rows } = await c.query("select * from audit_log order by id desc limit 1");
      expect(rows[0]).toMatchObject({
        actor_id: i.admin,
        actor_kind: "user",
        action: "update",
        entity_type: "grants",
        entity_id: i.grantA,
        grant_id: i.grantA,
        request_id: "req-1",
      });
      expect(rows[0].before.name).toBe("Alpha");
      expect(rows[0].after.name).toBe("Renamed");
    });
  });

  it("skips updates that change nothing", async () => {
    await asUser(i.admin, async (c) => {
      const count = async () => Number((await c.query("select count(*) n from audit_log")).rows[0].n);
      const start = await count();
      await c.query("update grants set name = name where id = $1", [i.grantA]);
      expect(await count()).toBe(start);
    });
  });

  it("never records password hashes", async () => {
    const { rows } = await asOwner((c) => c.query("select * from audit_log where entity_type = 'user_credentials'"));
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain("secret-hash");
  });

  it("hides payroll changes from admins without payroll access", async () => {
    const payroll = "select count(*)::int n from audit_log where entity_type in ('employees', 'payroll_entries') or entity_id = any($1)";
    const hidden = [[i.filePayroll, i.importPayroll, i.importRowPayroll, i.proposalPayroll, i.warningPayroll, i.extractionPayroll]];
    expect((await asUser(i.admin, (c) => c.query(payroll, hidden))).rows[0].n).toBe(0);
    expect((await asUser(i.adminPay, (c) => c.query(payroll, hidden))).rows[0].n).toBeGreaterThan(7);
  });

  it("cannot be edited, deleted or truncated, even by the owner", async () => {
    for (const statement of ["update audit_log set action = 'x'", "delete from audit_log", "truncate audit_log"]) {
      await expect(asOwner((c) => c.query(statement))).rejects.toThrow("append-only");
    }
  });

  it("takes the actor from the session", async () => {
    await asUser(i.viewer, (c) => c.query("select app.log_event('file.downloaded', 'files', $1)", [i.fileGeneral]));
    await asUser(i.admin, async (c) => {
      await c.query("select app.log_event('file.downloaded', 'files', $1)", [i.fileGeneral]);
      const { rows } = await c.query("select * from audit_log order by id desc limit 1");
      expect(rows[0]).toMatchObject({ actor_id: i.admin, action: "file.downloaded" });
    });
  });

  it("refuses forged row events and outsiders", async () => {
    await expect(asUser(i.staff, (c) => c.query("select app.log_event('update', 'grants')"))).rejects.toThrow("Unknown audit event");
    await expect(asUser(null, (c) => c.query("select app.log_event('file.downloaded', 'files')"))).rejects.toThrow("Not allowed");
    await expect(asUser(i.deactivated, (c) => c.query("select app.log_event('file.downloaded', 'files')"))).rejects.toThrow("Not allowed");
  });

  it("records system events", async () => {
    await asSystem((c) => c.query("select app.log_event('job.daily_completed', 'jobs')"));
  });
});

describe("recent activity", () => {
  it("gives members the actor, action and label without values", async () => {
    await asUser(i.staff, async (c) => {
      await c.query("update documents set title = 'W-9 form' where id = $1", [i.document]);
      const { rows, fields } = await c.query("select * from recent_activity order by id desc limit 1");
      expect(rows[0]).toMatchObject({ actor_name: "Sam", action: "update", entity_type: "documents", label: "W-9 form" });
      expect(fields.map((field) => field.name)).toEqual([
        "id", "occurred_at", "actor_id", "actor_name", "action", "entity_type", "entity_id", "grant_id", "label",
      ]);
    });
  });

  it("leaves out payroll, people, files, AI and credentials", async () => {
    const { rows } = await asUser(i.viewer, (c) => c.query("select distinct entity_type from recent_activity"));
    const types = rows.map((row) => row.entity_type);
    expect(types).toContain("grants");
    for (const hidden of ["employees", "payroll_runs", "payroll_entries", "imports", "import_rows", "users", "user_credentials", "files", "ai_extractions", "ai_proposals", "warnings"]) {
      expect(types).not.toContain(hidden);
    }
  });
});

describe("actor stamping", () => {
  it("overrides a spoofed creator and reviewer", async () => {
    await asUser(i.staff, async (c) => {
      const doc = await c.query(
        "insert into documents (title, category, created_by) values ('N', 'policy', $1) returning created_by",
        [i.admin],
      );
      expect(doc.rows[0].created_by).toBe(i.staff);
      const review = await c.query(
        "update ai_proposals set status = 'accepted', reviewed_by = $1, reviewed_at = now() where id = $2 returning reviewed_by",
        [i.admin, i.proposal],
      );
      expect(review.rows[0].reviewed_by).toBe(i.staff);
      const moved = await c.query("update grants set created_by = $1 where id = $2 returning created_by", [i.admin, i.grantA]);
      expect(moved.rows[0].created_by).toBeNull();
    });
  });

  it("keeps json and money intact", async () => {
    await asUser(i.staff, async (c) => {
      const { rows } = await c.query(
        "insert into ai_proposals (extraction_id, target_entity, target_field, proposed_value) values ($1, 'x', 'x', 'null') returning proposed_value::text v",
        [i.extraction],
      );
      expect(rows[0].v).toBe("null");
      const grant = await c.query("update grants set award_cents = 9007199254740991 where id = $1 returning award_cents", [i.grantA]);
      expect(grant.rows[0].award_cents).toBe("9007199254740991");
    });
  });
});

describe("recent activity for documents", () => {
  it("shows a new document once and a replacement as a replacement", async () => {
    await asUser(i.staff, async (c) => {
      const last = (await c.query("select max(id) id from recent_activity")).rows[0].id;
      const { rows } = await c.query("insert into documents (title, category) values ('New', 'policy') returning id");
      await c.query("insert into document_versions (document_id, version_no, file_id) values ($1, 1, $2)", [rows[0].id, i.fileSpare]);
      await c.query("insert into document_versions (document_id, version_no, file_id) values ($1, 2, $2)", [rows[0].id, i.filePending]);
      const seen = await c.query("select entity_type, label from recent_activity where id > $1 order by id", [last]);
      expect(seen.rows).toEqual([
        { entity_type: "documents", label: "New" },
        { entity_type: "document_versions", label: "New" },
      ]);
    });
  });
});
