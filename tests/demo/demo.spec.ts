import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "../../seed/pdf";

const people = { Admin: "Alex Morgan", Staff: "Jamie Lee", "View-only": "Taylor Brooks" } as const;

async function enter(page: Page, role: keyof typeof people): Promise<void> {
  await page.goto("#/login");
  await page.getByRole("button", { name: `Use ${role}` }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("$600,000")).toBeVisible();
  await expect(page.getByText(`${people[role]} · ${role}`).first()).toBeAttached();
}

const leave = async (page: Page) => {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
};

test("shows the loader, then asks for sign-in, and refuses a wrong password", async ({ page }) => {
  await page.goto("");
  await expect(page.getByText("Building your demo database")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  await page.getByLabel("Work email", { exact: true }).fill("alex@example.org");
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("do not match");
});

test("admin manages people, runs alerts and reads the audit log", async ({ page }) => {
  await enter(page, "Admin");
  await page.getByRole("link", { name: "People & permissions" }).click();
  await expect(page.getByText("4 of 5 accounts in use")).toBeVisible();
  await page.getByRole("button", { name: "+ Invite person" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Nia Cole");
  await page.getByRole("dialog").getByLabel("Work email").fill("nia@example.org");
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("5 of 5 accounts in use")).toBeVisible();
  await page.getByRole("link", { name: "Demo inbox" }).click();
  await page.getByRole("button", { name: "Run alerts now" }).click();
  await expect(page.getByText(/[1-9]\d* sent, 0 already sent/)).toBeVisible();
  await page.getByText("You have been invited").first().click();
  const link = (await page.getByRole("link", { name: "Open the link in this email" }).first().getAttribute("href"))!;
  await leave(page);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Join your workspace" })).toBeVisible();
  await page.getByLabel("Your name").fill("Nia Cole");
  await page.getByLabel("Password").fill("a long new password");
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByText("Your account is ready")).toBeVisible();
  await enter(page, "Admin");
  await page.goto("#/settings/audit");
  await expect(page.getByText("auth invite accepted")).toBeVisible();
});

test("staff upload, review simulated AI and keep the result after a reload", async ({ page }) => {
  await enter(page, "Staff");
  await page.goto("#/organisation/documents?new=1");
  await page.locator('input[type="file"]').setInputFiles({ name: "cover.pdf", mimeType: "application/pdf", buffer: Buffer.from(makePdf("Cover", [["This certificate expires on 5 June 2031."]])) });
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByText("Reading the document").first()).toBeVisible();
  await expect(page.getByLabel("Expiration date · Optional")).toHaveValue("2031-06-05");
  await page.getByLabel("I reviewed the suggested dates.").check();
  await page.getByRole("button", { name: "Confirm & upload" }).click();
  await expect(page.getByRole("row", { name: /cover/ })).toContainText("Expires 5 Jun 2031");
  await page.reload();
  await expect(page.getByRole("row", { name: /cover/ })).toContainText("Expires 5 Jun 2031");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download cover" }).click();
  await download;
});

test("staff read a contract and add a deadline", async ({ page }) => {
  await enter(page, "Staff");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Youth pathways" }).click();
  await page.getByRole("link", { name: "Contract", exact: true }).click();
  await page.getByRole("button", { name: "Read with AI" }).click();
  await expect(page.getByRole("heading", { name: "Review extracted contract details" })).toBeVisible();
  await expect(page.getByLabel("Award amount (US$)")).toHaveValue("120000.00");
  await page.getByLabel("I reviewed all suggested values and deadlines.").check();
  await page.getByRole("button", { name: "Confirm & save" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Youth pathways" })).toBeVisible();
  await page.goto("#/deadlines?new=1");
  await page.getByLabel("Title").fill("Board pack");
  await page.getByLabel("Due date").fill(new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Add deadline" }).click();
  await expect(page.getByRole("link", { name: /Board pack/ })).toBeVisible();
  await page.getByLabel("Owner", { exact: true }).selectOption({ label: "Sam Rivera" });
  await expect(page.getByRole("link", { name: /Board pack/ })).toHaveCount(0);
});

test("view-only can read, but has no way to change anything", async ({ page }) => {
  await enter(page, "View-only");
  await expect(page.getByRole("link", { name: /Upload|People & permissions|Audit log|Demo inbox/ })).toHaveCount(0);
  for (const path of ["#/settings/people", "#/settings/audit", "#/settings/outbox", "#/grants/new", "#/organisation/edit"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  }
  await page.goto("#/organisation");
  await expect(page.getByText("125 Harbor Way, Portland, OR 97201")).toBeVisible();
  await leave(page);
});

test("the in-browser database enforces roles", async ({ page }) => {
  await enter(page, "View-only");
  const outcome = await page.evaluate(async () => {
    const tools = (window as unknown as { demoAs: (email: string, statement: string) => Promise<string> }).demoAs;
    return {
      viewerWrites: await tools("taylor@example.org", "update grants set name = 'Changed'"),
      viewerPayroll: await tools("taylor@example.org", "select * from employees"),
      staffWrites: await tools("jamie@example.org", "update grants set sort_order = sort_order"),
      staffUsers: await tools("sam@example.org", "update users set role = 'admin' where email = 'sam@example.org'"),
      strangerReads: await tools("nobody@example.org", "select * from grants"),
      adminAudit: await tools("alex@example.org", "select id from audit_log limit 1"),
      adminTampers: await tools("alex@example.org", "delete from audit_log"),
    };
  });
  expect(outcome).toEqual({
    viewerWrites: "0 rows",
    viewerPayroll: "0 rows",
    staffWrites: "6 rows",
    staffUsers: "0 rows",
    strangerReads: "0 rows",
    adminAudit: "1 rows",
    adminTampers: "refused",
  });
});

test("reset restores the original data", async ({ page }) => {
  await enter(page, "Staff");
  await page.goto("#/deadlines?new=1");
  await page.getByLabel("Title").fill("Temporary");
  await page.getByLabel("Due date").fill(new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Add deadline" }).click();
  await expect(page.getByRole("link", { name: /Temporary/ })).toBeVisible();
  await leave(page);
  await page.getByRole("button", { name: "Reset the demo data" }).click();
  await expect(page.getByText("Building your demo database")).toBeVisible();
  await enter(page, "Staff");
  await page.goto("#/deadlines");
  await expect(page.getByRole("link", { name: /Quarterly impact report/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Temporary/ })).toHaveCount(0);
});

test("works on a phone", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  await enter(page, "Admin");
  for (const path of ["#/", "#/grants", "#/deadlines", "#/organisation", "#/settings/people", "#/login"]) {
    await page.goto(path);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBe(0);
  }
  await context.close();
});
