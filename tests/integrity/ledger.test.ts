import type { PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { ids as i } from "../helpers/fixtures";
import { asOwner, asUser, closePools } from "../helpers/session";

afterAll(closePools);

const settle = (c: PoolClient) => c.query("set constraints all immediate");
const confirm = (c: PoolClient, id: string) =>
  c.query("update receipts set status = 'confirmed', confirmed_by = $2, confirmed_at = now() where id = $1", [id, i.staff]);
const post = (c: PoolClient, id: string) =>
  c.query("update payroll_runs set status = 'posted', posted_by = $2, posted_at = now() where id = $1", [id, i.staffPay]);

describe("receipts", () => {
  it("confirms when allocations equal the total", async () => {
    await asUser(i.staff, async (c) => {
      await confirm(c, i.receiptDraft);
      await settle(c);
    });
  });

  it.each([499, 501])("refuses allocations of %i cents against 500", async (amount) => {
    await asUser(i.staff, async (c) => {
      await c.query("update receipt_allocations set amount_cents = $1 where id = $2", [amount, i.allocationDraft]);
      await confirm(c, i.receiptDraft);
      await expect(settle(c)).rejects.toMatchObject({ constraint: "receipts_reconcile" });
    });
  });

  it("splits one receipt across grants", async () => {
    await asUser(i.staff, async (c) => {
      await c.query("update receipt_allocations set amount_cents = 167 where id = $1", [i.allocationDraft]);
      await c.query("insert into receipt_allocations (receipt_id, grant_id, category_id, amount_cents) values ($1, $2, $3, 333)", [
        i.receiptDraft,
        i.grantB,
        i.categoryB,
      ]);
      await confirm(c, i.receiptDraft);
      await settle(c);
    });
  });

  it("refuses a category from another grant", async () => {
    await expect(
      asUser(i.staff, (c) =>
        c.query("insert into receipt_allocations (receipt_id, grant_id, category_id, amount_cents) values ($1, $2, $3, 1)", [
          i.receiptDraft,
          i.grantA,
          i.categoryB,
        ]),
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it.each([
    `update receipts set total_cents = 1 where id = '${i.receiptConfirmed}'`,
    `update receipts set status = 'draft' where id = '${i.receiptConfirmed}'`,
    `update receipt_allocations set amount_cents = 1 where receipt_id = '${i.receiptConfirmed}'`,
    `update receipt_allocations set receipt_id = '${i.receiptConfirmed}' where id = '${i.allocationDraft}'`,
    `delete from receipt_allocations where receipt_id = '${i.receiptConfirmed}'`,
    `insert into receipt_allocations (receipt_id, grant_id, category_id, amount_cents) values ('${i.receiptConfirmed}', '${i.grantB}', '${i.categoryB}', 1)`,
  ])("locks confirmed receipts: %s", async (statement) => {
    await expect(asUser(i.staff, (c) => c.query(statement))).rejects.toMatchObject({ constraint: "lifecycle_locked" });
  });

  it("refuses a receipt created as confirmed", async () => {
    await expect(
      asUser(i.staff, (c) =>
        c.query("insert into receipts (total_cents, status, confirmed_by, confirmed_at) values (1, 'confirmed', $1, now())", [i.staff]),
      ),
    ).rejects.toMatchObject({ constraint: "lifecycle_start" });
  });

  it("removes a voided receipt from balances", async () => {
    await asUser(i.staff, async (c) => {
      const spent = async () =>
        Number((await c.query("select spent_cents s from category_balances where category_id = $1", [i.categoryA2])).rows[0].s);
      expect(await spent()).toBe(1000);
      await c.query("update receipts set status = 'voided', voided_by = $2, voided_at = now() where id = $1", [i.receiptConfirmed, i.staff]);
      expect(await spent()).toBe(0);
    });
  });

  it("deletes a draft with its allocations", async () => {
    await asUser(i.staff, async (c) => {
      await c.query("delete from receipts where id = $1", [i.receiptDraft]);
      const left = await c.query("select 1 from receipt_allocations where id = $1", [i.allocationDraft]);
      expect(left.rows).toEqual([]);
    });
  });
});

describe("payroll", () => {
  it("refuses to post splits below 100 percent", async () => {
    await asUser(i.staffPay, async (c) => {
      await post(c, i.runDraft);
      await expect(settle(c)).rejects.toMatchObject({ constraint: "payroll_reconcile" });
    });
  });

  it("refuses to post when cents are lost to rounding", async () => {
    await asUser(i.staffPay, async (c) => {
      await c.query("insert into payroll_allocations (entry_id, percent_bp, amount_cents) values ($1, 5000, 5001)", [i.entryDraft]);
      await post(c, i.runDraft);
      await expect(settle(c)).rejects.toMatchObject({ constraint: "payroll_reconcile" });
    });
  });

  it("posts an exact split", async () => {
    await asUser(i.staffPay, async (c) => {
      await c.query("insert into payroll_allocations (entry_id, percent_bp, amount_cents) values ($1, 5000, 5000)", [i.entryDraft]);
      await post(c, i.runDraft);
      await settle(c);
    });
  });

  it("refuses to post an empty run", async () => {
    await asUser(i.staffPay, async (c) => {
      await c.query("delete from payroll_entries where run_id = $1", [i.runDraft]);
      await post(c, i.runDraft);
      await expect(settle(c)).rejects.toMatchObject({ constraint: "payroll_reconcile" });
    });
  });

  it.each([
    `update payroll_entries set cost_cents = 1 where id = '${i.entryPosted}'`,
    `update payroll_allocations set amount_cents = 1 where entry_id = '${i.entryPosted}'`,
    `update payroll_allocations set entry_id = '${i.entryPosted}' where id = '${i.allocationPayroll}'`,
    `delete from payroll_entries where id = '${i.entryPosted}'`,
    `update payroll_runs set pay_date = '2026-12-01' where id = '${i.runPosted}'`,
  ])("locks posted runs: %s", async (statement) => {
    await expect(asUser(i.staffPay, (c) => c.query(statement))).rejects.toMatchObject({ constraint: "lifecycle_locked" });
  });

  it("refuses the same payroll twice unless voided", async () => {
    const again = "insert into payroll_runs (period_start, period_end, pay_date, fingerprint) values ('2026-01-01', '2026-01-15', '2026-01-20', 'f1')";
    await expect(asUser(i.staffPay, (c) => c.query(again))).rejects.toMatchObject({ constraint: "payroll_runs_fingerprint_key" });
    await asUser(i.staffPay, async (c) => {
      await c.query("update payroll_runs set status = 'voided', voided_by = $2, voided_at = now() where id = $1", [i.runPosted, i.staffPay]);
      await c.query(again);
    });
  });

  it("refuses remembered splits that do not total 100 percent", async () => {
    await asUser(i.staffPay, async (c) => {
      await c.query("update employee_splits set percent_bp = 9999 where id = $1", [i.split]);
      await expect(settle(c)).rejects.toMatchObject({ constraint: "employee_splits_total" });
    });
  });

  it("never stores a raw payroll row or file", async () => {
    await expect(
      asUser(i.staffPay, (c) => c.query("update import_rows set raw = '{}' where id = $1", [i.importRowPayroll])),
    ).rejects.toMatchObject({ constraint: "import_rows_payroll_raw" });
    await expect(
      asUser(i.staffPay, (c) => c.query("update imports set file_id = $1 where id = $2", [i.filePayroll, i.importPayroll])),
    ).rejects.toMatchObject({ constraint: "imports_payroll" });
    await expect(
      asUser(i.staffPay, (c) => c.query("update imports set sensitivity = 'general' where id = $1", [i.importPayroll])),
    ).rejects.toMatchObject({ constraint: "imports_payroll" });
  });
});

describe("budgets", () => {
  it.each([
    `update budgets set version_no = 9 where id = '${i.budgetApproved}'`,
    `update budget_lines set amount_cents = 1 where budget_id = '${i.budgetApproved}'`,
    `update budget_lines set budget_id = '${i.budgetApproved}' where id = '${i.budgetLine}'`,
  ])("locks approved budgets: %s", async (statement) => {
    await expect(asUser(i.staff, (c) => c.query(statement))).rejects.toMatchObject({ constraint: "lifecycle_locked" });
  });

  it("allows one approved budget per grant", async () => {
    const approve = "update budgets set status = 'approved', approved_by = $2, approved_at = now() where id = $1";
    await expect(asUser(i.staff, (c) => c.query(approve, [i.budgetDraft, i.staff]))).rejects.toMatchObject({
      constraint: "budgets_one_approved",
    });
    await asUser(i.staff, async (c) => {
      await c.query("update budgets set status = 'superseded' where id = $1", [i.budgetApproved]);
      await c.query(approve, [i.budgetDraft, i.staff]);
    });
  });
});

describe("balances", () => {
  it("reconcile with the rows behind them", async () => {
    const rows = await asUser(i.viewer, (c) =>
      c.query("select * from category_balances where grant_id = $1 order by name", [i.grantA]),
    );
    expect(rows.rows).toMatchObject([
      { name: "Salary", budget_cents: "70000", receipts_cents: "0", payroll_cents: "5001", remaining_cents: "64999" },
      { name: "Supplies", budget_cents: "30000", receipts_cents: "1000", payroll_cents: "0", remaining_cents: "29000" },
    ]);
    const total = await asUser(i.viewer, (c) => c.query("select * from grant_balances where grant_id = $1", [i.grantA]));
    expect(total.rows[0]).toMatchObject({ award_cents: "100000", budget_cents: "100000", spent_cents: "6001", remaining_cents: "93999" });
  });
});

describe("constraints", () => {
  it.each([
    [`insert into grant_links (grant_id, label, url) values ('${i.grantA}', 'x', 'javascript:alert(1)')`, "grant_links_https"],
    ["insert into organization_profile (id, legal_name) values (2, 'x')", "organization_profile_singleton"],
    ["insert into documents (title, category) values ('x', 'executed_contract')", "documents_contract_has_grant"],
    [`update deadlines set status = 'completed' where id = '${i.deadline}'`, "deadlines_completed"],
    [`update deadlines set reminder_days = 0 where id = '${i.deadline}'`, "deadlines_reminder"],
    [`update grants set ends_on = '2025-01-01' where id = '${i.grantA}'`, "grants_period"],
    [`update ai_proposals set status = 'accepted' where id = '${i.proposal}'`, "ai_proposals_reviewed"],
    ["insert into users (name, email) values ('x', 'ADA@example.org')", "users_email_lower_key"],
  ])("refuses %s", async (statement, constraint) => {
    await expect(
      asOwner(async (c) => {
        if (statement.includes("into users")) {
          await c.query("update users set status = 'deactivated' where id = any($1)", [[i.viewer, i.viewerPay]]);
        }
        await c.query(statement);
      }),
    ).rejects.toMatchObject({ constraint });
  });

  it("allows one live contract per grant", async () => {
    const insert = `insert into documents (grant_id, title, category) values ('${i.grantA}', 'x', 'executed_contract')`;
    await asUser(i.staff, async (c) => {
      await c.query(insert);
      await expect(c.query(insert)).rejects.toMatchObject({ constraint: "documents_one_live_contract" });
    });
  });

  it("locks a proposal once reviewed", async () => {
    await asUser(i.staff, async (c) => {
      const review = "update ai_proposals set status = 'rejected', reviewed_by = $2, reviewed_at = now() where id = $1";
      expect((await c.query(review, [i.proposal, i.staff])).rowCount).toBe(1);
      expect((await c.query(review, [i.proposal, i.staff])).rowCount).toBe(0);
    });
  });
});
