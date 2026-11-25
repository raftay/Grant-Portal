import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { connect } from "@/db/client";
import { withUser } from "@/db/with-user";
import { grants } from "@/db/schema";
import { ownerUrl, userUrl } from "../helpers/config";
import { ids as i } from "../helpers/fixtures";
import { allowed, asOwner, asSystem, asUser, closePools } from "../helpers/session";

afterAll(closePools);

describe("database configuration", () => {
  it("enables row level security on every table", async () => {
    const result = await asOwner((c) =>
      c.query("select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity"),
    );
    expect(result.rows).toEqual([]);
  });

  it("gives runtime roles no elevated attributes and no ownership", async () => {
    const roles = await asOwner((c) =>
      c.query("select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname in ('app_user', 'app_system')"),
    );
    expect(roles.rows).toHaveLength(2);
    expect(roles.rows.flatMap((row) => Object.values(row))).not.toContain(true);
    const owned = await asOwner((c) =>
      c.query("select 1 from pg_class c join pg_roles r on r.oid = c.relowner where r.rolname in ('app_user', 'app_system')"),
    );
    expect(owned.rows).toEqual([]);
  });

  it("pins search_path on every app function", async () => {
    const result = await asOwner((c) =>
      c.query("select proname from pg_proc where pronamespace = 'app'::regnamespace and proconfig is null"),
    );
    expect(result.rows).toEqual([]);
  });

  it("lets nobody run app functions by default", async () => {
    const result = await asOwner((c) =>
      c.query(`select p.proname from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        where p.pronamespace = 'app'::regnamespace and a.grantee = 0`),
    );
    expect(result.rows).toEqual([]);
  });
});

describe("withUser", () => {
  it("scopes identity to its transaction on a reused connection", async () => {
    const db = connect(userUrl, 1);
    const seen = await withUser({ userId: i.viewer }, (tx) => tx.select().from(grants), db);
    expect(seen).toHaveLength(2);
    expect(await db.select().from(grants)).toEqual([]);
    await db.$client.end();
  });

  it("rejects a malformed identity", async () => {
    await expect(asUser("not-a-uuid", (c) => c.query("select 1 from grants"))).rejects.toThrow();
  });
});

describe("users", () => {
  it("only lets an admin invite, and only as invited", async () => {
    const insert = (status: string) =>
      `insert into users (name, email, role, status) values ('N', 'n@example.org', 'viewer', '${status}')`;
    const roomy = new Pool({ connectionString: ownerUrl });
    await roomy.query("update users set status = 'deactivated' where id = any($1)", [[i.viewer, i.viewerPay]]);
    try {
      expect(await asUser(i.admin, (c) => allowed(c, insert("invited")))).toBe(true);
      expect(await asUser(i.admin, (c) => allowed(c, insert("active")))).toBe(false);
      for (const person of [i.staff, i.staffPay, i.viewer, i.deactivated, null]) {
        expect(await asUser(person, (c) => allowed(c, insert("invited")))).toBe(false);
      }
    } finally {
      await roomy.query("alter table users disable trigger b_guard");
      await roomy.query("update users set status = 'active' where id = any($1)", [[i.viewer, i.viewerPay]]);
      await roomy.query("alter table users enable trigger b_guard");
      await roomy.end();
    }
  });

  it("refuses a sixth account", async () => {
    await expect(
      asOwner((c) => c.query("insert into users (name, email) values ('N', 'n@example.org')")),
    ).rejects.toMatchObject({ constraint: "users_seat_limit" });
  });

  it("frees a seat on deactivation and refuses reactivation past the limit", async () => {
    await asOwner(async (c) => {
      await c.query("update users set status = 'deactivated' where id = any($1)", [[i.viewer, i.viewerPay]]);
      await c.query("insert into users (name, email) values ('N', 'n@example.org')");
      await expect(c.query("update users set status = 'active' where id = $1", [i.viewer])).rejects.toMatchObject({
        constraint: "users_seat_limit",
      });
    });
  });

  it("holds the limit under concurrent invites", async () => {
    const pool = new Pool({ connectionString: ownerUrl });
    await pool.query("update users set status = 'deactivated' where id = any($1)", [[i.viewer, i.viewerPay]]);
    const [first, second] = [await pool.connect(), await pool.connect()];
    const insert = "insert into users (name, email) values ('N', $1)";
    await first.query("begin");
    await first.query(insert, ["race1@example.org"]);
    const waiting = second.query(insert, ["race2@example.org"]).then(
      () => "inserted",
      (error: { constraint?: string }) => error.constraint,
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    await first.query("commit");
    const outcome = await waiting;
    first.release();
    second.release();
    await pool.query("alter table users disable trigger b_guard");
    await pool.query("delete from users where email like 'race%'");
    await pool.query("update users set status = 'active' where id = any($1)", [[i.viewer, i.viewerPay]]);
    await pool.query("alter table users enable trigger b_guard");
    await pool.end();
    expect(outcome).toBe("users_seat_limit");
  });

  it("keeps one active admin", async () => {
    await asOwner(async (c) => {
      await c.query("update users set role = 'staff' where id = $1", [i.admin]);
      await expect(c.query("update users set status = 'deactivated' where id = $1", [i.adminPay])).rejects.toMatchObject({
        constraint: "users_last_admin",
      });
    });
  });

  it("bumps the session version on access changes only", async () => {
    await asUser(i.admin, async (c) => {
      const version = async () => (await c.query("select session_version v from users where id = $1", [i.staff])).rows[0].v;
      const start = await version();
      await c.query("update users set name = 'Renamed' where id = $1", [i.staff]);
      expect(await version()).toBe(start);
      await c.query("update users set role = 'viewer' where id = $1", [i.staff]);
      expect(await version()).toBe(start + 1);
    });
  });

  it("applies a role change on the next statement", async () => {
    await asUser(i.admin, async (c) => {
      await c.query("update users set role = 'viewer' where id = $1", [i.admin]);
      expect(await allowed(c, "update grants set name = 'X'")).toBe(false);
    });
  });
});

describe("app_system", () => {
  it.each([
    "select 1 from employees",
    "select 1 from payroll_runs",
    "select 1 from payroll_entries",
    "select 1 from payroll_allocations",
    "select 1 from employee_splits",
    "select 1 from receipts",
    "select 1 from imports",
    "select 1 from audit_log",
    "select 1 from category_balances",
    `update users set role = 'admin' where id = '${i.staff}'`,
    `update users set can_view_payroll = true where id = '${i.staff}'`,
    `update users set status = 'active' where id = '${i.deactivated}'`,
    "insert into users (name, email) values ('N', 'n@example.org')",
    "update grants set name = 'X'",
    `select 1 from files where id = '${i.fileGeneral}'`,
    `update files set status = 'ready', ready_at = now() where id = '${i.filePending}'`,
  ])("cannot run %s", async (statement) => {
    expect(await asSystem((c) => allowed(c, statement))).toBe(false);
  });

  it.each([
    "select 1 from users",
    "select 1 from user_credentials",
    "select 1 from documents",
    "select 1 from deadlines",
    "insert into login_attempts (email_hash, ip_hash, succeeded) values ('a', 'b', false)",
    `update users set email_verified = now() where id = '${i.staff}'`,
    `update files set status = 'failed' where id = '${i.filePending}'`,
  ])("can run %s", async (statement) => {
    expect(await asSystem((c) => allowed(c, statement))).toBe(true);
  });
});
