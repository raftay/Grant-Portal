import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { makePdf } from "../../seed/pdf";
import { password } from "./environment";

const phone = { width: 375, height: 800 };

async function signIn(page: Page, email: string, secret = password): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Work email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(secret);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your mission. All in one place." })).toBeVisible();
}

async function as(browser: Browser, person: string, work: (page: Page) => Promise<void>): Promise<void> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, `${person}@example.org`);
  await work(page);
  await context.close();
}

const pdf = (name: string, text: string) => ({ name, mimeType: "application/pdf", buffer: makePdf(name, [[text]]) });

async function openGrant(page: Page, name: string): Promise<void> {
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("signed-out visitors are sent to sign in, and bad passwords are explained", async ({ page }) => {
  await page.goto("/deadlines");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Work email", { exact: true }).fill("alex@example.org");
  await page.getByLabel("Password").fill("wrong password here");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("do not match");
});

test("home shows the portfolio, attention items and Phase 2 placeholders", async ({ browser }) => {
  await as(browser, "alex", async (page) => {
    await expect(page.getByText("$600,000")).toBeVisible();
    const attention = page.locator("section", { hasText: "Needs attention" });
    await expect(attention.getByRole("listitem")).toHaveCount(3);
    await expect(attention).toContainText("Overdue");
    await expect(attention).toContainText("Quarterly impact report");
    await expect(page.getByText("Arrives in Phase 2")).toBeVisible();
    await expect(page.getByRole("link", { name: /Receipts|Payroll/ })).toHaveCount(0);
  });
});

test("profile fields copy to the clipboard and edits are saved", async ({ browser }) => {
  await as(browser, "jamie", async (page) => {
    await page.goto("/organisation");
    await page.getByRole("button", { name: "Copy Address" }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("125 Harbor Way, Portland, OR 97201");
    await page.getByRole("link", { name: "Edit profile" }).click();
    await page.getByLabel("EIN", { exact: true }).fill("123");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("alert").first()).toContainText("12-3456789");
    await expect(page.getByLabel("EIN", { exact: true })).toHaveValue("123");
    await page.getByLabel("EIN", { exact: true }).fill("11-2223334");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("11-2223334")).toBeVisible();
  });
});

test("an uploaded document is read by AI, reviewed, saved and replaced", async ({ browser }) => {
  await as(browser, "sam", async (page) => {
    await page.goto("/organisation/documents?new=1");
    await expect(page.getByText("bank, routing or wire numbers")).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(pdf("liability-cover.pdf", "This certificate expires on"));
    await expect(page.getByText("“This certificate expires on”")).toBeVisible();
    await expect(page.getByText("AI suggested")).toHaveCount(1);
    await expect(page.getByLabel("Document title")).toHaveValue("liability-cover");
    await page.getByRole("button", { name: "Confirm & upload" }).click();
    await expect(page.getByRole("alert").first()).toContainText("reviewed");
    await page.getByLabel("I reviewed the suggested dates.").check();
    await page.getByRole("button", { name: "Confirm & upload" }).click();
    const row = page.getByRole("row", { name: /liability-cover/ });
    await expect(row).toContainText("Expires");
    await row.getByRole("link", { name: "liability-cover", exact: true }).click();
    await expect(page.getByText(/Version 1 · current/)).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(pdf("renewed.pdf", "renewed"));
    await expect(page.getByText(/Version 2 · current · renewed.pdf/)).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: /^Download liability/ }).click();
    expect((await download).suggestedFilename()).toBe("renewed.pdf");
    await page.getByRole("button", { name: "Archive" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Archive" }).click();
    await expect(page).toHaveURL(/\/organisation\/documents$/);
    await expect(page.getByRole("row", { name: /liability-cover/ })).toHaveCount(0);
  });
});

test("when AI fails the form still works by hand", async ({ browser }) => {
  await as(browser, "sam", async (page) => {
    await page.goto("/organisation/documents?new=1");
    await page.locator('input[type="file"]').setInputFiles(pdf("smudged.pdf", "UNREADABLE"));
    await expect(page.getByText("AI could not read this file")).toBeVisible();
    await page.getByLabel("Document type").selectOption("policy");
    await page.getByLabel(/Next review date/).fill("2031-05-06");
    await page.getByRole("button", { name: "Confirm & upload" }).click();
    await expect(page.getByRole("row", { name: /smudged/ })).toContainText("Review 6 May 2031");
  });
});

test("a mislabelled file is refused", async ({ browser }) => {
  await as(browser, "sam", async (page) => {
    await page.goto("/organisation/documents?new=1");
    await page.locator('input[type="file"]').setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("<script>alert(1)</script>") });
    await expect(page.getByRole("alert").first()).toContainText("do not match");
    await expect(page.getByRole("button", { name: "Confirm & upload" })).toBeDisabled();
  });
});

test("a contract is read, partly accepted and applied", async ({ browser }) => {
  await as(browser, "jamie", async (page) => {
    await openGrant(page, "Community wellbeing");
    await page.getByRole("link", { name: "Contract", exact: true }).click();
    await page.getByRole("button", { name: "Read with AI" }).click();
    await expect(page.getByRole("heading", { name: "Review extracted contract details" })).toBeVisible();
    await expect(page.getByLabel("Award amount (US$)")).toHaveValue("151000.50");
    await expect(page.getByText("“$151,000.50”")).toBeVisible();
    await page.getByLabel("Add this deadline").nth(1).uncheck();
    await page.getByRole("button", { name: "Confirm & save" }).click();
    await expect(page.getByRole("alert").first()).toContainText("reviewed");
    await page.getByLabel("I reviewed all suggested values and deadlines.").check();
    await page.getByRole("button", { name: "Confirm & save" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Community wellbeing" })).toBeVisible();
    await expect(page.getByText("$151,000.50")).toBeVisible();
    await expect(page.getByText("Site visit report")).toBeVisible();
    await expect(page.getByText("Unwanted deadline")).toHaveCount(0);
  });
});

test("contract suggestions can be discarded", async ({ browser }) => {
  await as(browser, "sam", async (page) => {
    await openGrant(page, "Youth pathways");
    await page.getByRole("link", { name: "Contract", exact: true }).click();
    await page.getByRole("button", { name: "Read with AI" }).click();
    await expect(page.getByRole("heading", { name: "Review extracted contract details" })).toBeVisible();
    const review = page.url();
    await page.getByRole("button", { name: "Discard" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Discard" }).click();
    await expect(page.getByText("$120,000")).toBeVisible();
    await page.goto(review);
    await expect(page.getByRole("heading", { name: "Nothing left to review" })).toBeVisible();
  });
});

test("deadlines are added, filtered, edited and completed", async ({ browser }) => {
  await as(browser, "alex", async (page) => {
    await page.goto("/deadlines");
    await page.getByRole("link", { name: "+ Add deadline" }).click();
    await page.getByLabel("Title").fill("Board summary");
    await page.locator("form", { hasText: "Email reminder" }).getByLabel("Grant", { exact: true }).selectOption({ label: "Food security" });
    const due = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Due date").fill(due);
    await page.getByLabel("Email reminder").selectOption("14");
    await page.getByRole("button", { name: "Add deadline" }).click();
    await expect(page.getByRole("link", { name: /Board summary/ })).toBeVisible();
    await page.getByLabel("Grant", { exact: true }).selectOption({ label: "Food security" });
    await expect(page.getByRole("link", { name: /Quarterly impact report/ })).toHaveCount(0);
    await page.getByRole("link", { name: /Board summary/ }).click();
    await expect(page.getByText(/Last edited by Alex Morgan/)).toBeVisible();
    await page.getByLabel("Status").selectOption("completed");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("section", { hasText: "Completed and waived" })).toContainText("Board summary");
  });
});

test("grants, contacts and links can be managed", async ({ browser }) => {
  await as(browser, "jamie", async (page) => {
    await page.goto("/grants");
    await page.getByRole("link", { name: "+ New grant" }).click();
    await page.getByLabel("Grant name").fill("Arts access");
    await page.getByLabel("Short code").fill("AA-1");
    await page.getByLabel("Funder").fill("Canvas Trust");
    await page.getByLabel("Award amount (US$)").fill("25,000.75");
    await page.getByLabel("Grant period starts").fill("2026-02-01");
    await page.getByLabel("Grant period ends").fill("2026-01-01");
    await page.getByRole("button", { name: "Create grant" }).click();
    await expect(page.getByRole("alert").first()).toContainText("end date");
    await expect(page.getByLabel("Grant name")).toHaveValue("Arts access");
    await page.getByLabel("Grant period ends").fill("2027-01-31");
    await page.getByRole("button", { name: "Create grant" }).click();
    await expect(page.getByText("$25,000.75")).toBeVisible();
    await page.getByRole("link", { name: "Contacts & links" }).click();
    await page.getByRole("button", { name: "+ Add contact" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Quinn");
    await page.getByRole("button", { name: "Save contact" }).click();
    await expect(page.getByText("Quinn")).toBeVisible();
    await page.getByRole("button", { name: "+ Add link" }).click();
    await page.getByLabel("Label").fill("Portal");
    await page.getByLabel("Web address").fill("http://insecure.example.org");
    await page.getByRole("button", { name: "Save link" }).click();
    await expect(page.getByRole("alert").first()).toContainText("https://");
    await page.getByLabel("Web address").fill("https://secure.example.org");
    await page.getByRole("button", { name: "Save link" }).click();
    await expect(page.getByRole("link", { name: "https://secure.example.org" })).toBeVisible();
  });
});

test("view-only people can read but not change", async ({ browser }) => {
  await as(browser, "taylor", async (page) => {
    await expect(page.getByRole("link", { name: /Upload|People & permissions|Audit log|Demo inbox/ })).toHaveCount(0);
    await openGrant(page, "Food security");
    await expect(page.getByRole("link", { name: /Edit grant|contract/i })).toHaveCount(0);
    for (const path of ["/settings/people", "/settings/audit", "/settings/outbox", "/grants/new", "/organisation/edit"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    }
    await page.goto("/organisation/documents?new=1");
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await page.goto("/deadlines?new=1");
    await expect(page.getByRole("button", { name: "Add deadline" })).toHaveCount(0);
  });
});

test("a server action called with a viewer's session is refused", async ({ browser }) => {
  const captured: { headers: Record<string, string>; body: string; url: string }[] = [];
  await as(browser, "jamie", async (page) => {
    page.on("request", (request) => {
      const body = request.postData();
      if (request.method() === "POST" && request.headers()["next-action"] && body?.includes("Hijack")) captured.push({ headers: request.headers(), body, url: request.url() });
    });
    await page.goto("/deadlines?new=1");
    await page.getByLabel("Title").fill("Hijack");
    await page.getByLabel("Due date").fill("2030-01-01");
    await page.getByRole("button", { name: "Add deadline" }).click();
    await expect(page).toHaveURL(/\/deadlines$/);
  });
  const [call] = captured;
  expect(call).toBeDefined();
  await as(browser, "taylor", async (page) => {
    const headers = Object.fromEntries(Object.entries(call!.headers).filter(([name]) => !["cookie", "content-length", "host"].includes(name)));
    const response = await page.request.post(call!.url, { headers, data: call!.body.replaceAll("Hijack", "Replayed") });
    expect(await response.text()).toContain("do not have permission");
    await page.goto("/deadlines?window=all");
    await expect(page.getByText("Hijack")).toBeVisible();
    await expect(page.getByText("Replayed")).toHaveCount(0);
  });
});

test("an admin invites someone, who joins; the fifth seat then closes invites", async ({ browser }) => {
  await as(browser, "alex", async (page) => {
    await page.goto("/settings/people");
    await page.getByRole("button", { name: "+ Invite person" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill("Nia Cole");
    await page.getByRole("dialog").getByLabel("Work email").fill("nia@example.org");
    await page.getByRole("dialog").getByLabel("Role").selectOption("staff");
    await page.getByRole("button", { name: "Send invitation" }).click();
    await expect(page.getByText("5 of 5 accounts in use")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Invite person" })).toBeDisabled();
    await page.goto("/settings/outbox");
    await page.getByText("You have been invited").first().click();
    const link = await page.getByRole("link", { name: "Open the link in this email" }).first().getAttribute("href");
    const visitor = await browser.newContext();
    const guest = await visitor.newPage();
    await guest.goto(link!);
    await guest.getByLabel("Your name").fill("Nia Cole");
    await guest.getByLabel("Password").fill("a long new password");
    await guest.getByRole("button", { name: "Join" }).click();
    await expect(guest.getByText("Your account is ready")).toBeVisible();
    await signIn(guest, "nia@example.org", "a long new password");
    await page.goto("/settings/people");
    const row = page.getByRole("row", { name: /Nia Cole/ });
    await row.getByLabel("Role for Nia Cole").selectOption("viewer");
    await expect(page.getByText("Nia Cole changed from Staff to View-only")).toBeVisible();
    await guest.goto("/deadlines");
    await expect(guest).toHaveURL(/\/login/);
    await row.getByRole("button", { name: "Deactivate" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByText("4 of 5 accounts in use")).toBeVisible();
    await visitor.close();
  });
});

test("a reset link changes the password", async ({ browser, page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Work email").fill("sam@example.org");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("a reset link is on its way")).toBeVisible();
  await as(browser, "alex", async (admin) => {
    await admin.goto("/settings/outbox");
    await admin.getByText("Reset your Grant Portal password").first().click();
    await page.goto((await admin.getByRole("link", { name: "Open the link in this email" }).first().getAttribute("href"))!);
  });
  await page.getByLabel("New password").fill("sams brand new password");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByText("Password changed")).toBeVisible();
  await signIn(page, "sam@example.org", "sams brand new password");
});

test("alerts run once, and the audit log shows who ran them", async ({ browser }) => {
  await as(browser, "alex", async (page) => {
    await page.goto("/settings/outbox");
    await page.getByRole("button", { name: "Run alerts now" }).click();
    await expect(page.getByText(/[1-9]\d* sent, 0 already sent/)).toBeVisible();
    await expect(page.getByText("Overdue: Insurance certificate")).toBeVisible();
    await page.getByRole("button", { name: "Run alerts now" }).click();
    await expect(page.getByText(/0 sent, [1-9]\d* already sent/)).toBeVisible();
    await page.goto("/settings/audit?type=jobs");
    await expect(page.getByText("job daily requested").first()).toBeVisible();
    await expect(page.getByText(/Alex Morgan/).last()).toBeVisible();
  });
});

test("an emailed link signs in", async ({ browser, page }) => {
  await page.goto("/login");
  await page.getByText("Email me a sign-in link").click();
  await page.getByLabel("Work email for the link").fill("jamie@example.org");
  await page.getByRole("button", { name: "Send link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  await as(browser, "alex", async (admin) => {
    await admin.goto("/settings/outbox");
    await admin.getByText("Your Grant Portal sign-in link").first().click();
    await page.goto((await admin.getByRole("link", { name: "Open the link in this email" }).first().getAttribute("href"))!);
  });
  await expect(page.getByText("Jamie Lee · Staff").first()).toBeVisible();
});

test("every page fits a phone and passes accessibility checks", async ({ browser }) => {
  test.setTimeout(180_000);
  await as(browser, "alex", async (page) => {
    const grant = (await page.locator('a[href^="/grants/"]').first().getAttribute("href"))!;
    const document = (await page.locator('a[href^="/documents/"]').first().getAttribute("href"))!;
    const paths = ["/", "/organisation", "/organisation/edit", "/organisation/documents?new=1", document, "/grants", "/grants/new", grant, `${grant}/edit`, `${grant}/documents`, `${grant}/deadlines?new=1`, `${grant}/contacts`, `${grant}/contract`, "/deadlines", "/settings/people", "/settings/audit", "/settings/outbox"];
    for (const size of [phone, { width: 1440, height: 900 }]) {
      await page.setViewportSize(size);
      for (const path of paths) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth);
        expect(overflow, `${path} at ${size.width}`).toBe(0);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude("iframe").analyze();
        expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.target}`), `${path} at ${size.width}`).toEqual([]);
      }
    }
  });
  const context = await browser.newContext({ viewport: phone });
  const page = await context.newPage();
  for (const path of ["/login", "/forgot-password", "/reset-password/x", "/accept-invite/x"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.target}`), path).toEqual([]);
  }
  await context.close();
});

test("the phone menu opens, navigates and closes", async ({ browser }) => {
  const context = await browser.newContext({ viewport: phone });
  const page = await context.newPage();
  await signIn(page, "taylor@example.org");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Digital inclusion" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Digital inclusion" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Menu" })).toHaveCount(0);
  await page.getByRole("navigation", { name: "Quick links" }).getByRole("link", { name: "Deadlines" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Deadlines" })).toBeVisible();
  await context.close();
});

test("the paper loader shows while a page loads, and stays still for reduced motion", async ({ browser }) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await signIn(page, "taylor@example.org");
    await page.evaluate(() => {
      const seen: string[] = [];
      Object.assign(window, { seen });
      new MutationObserver(() => {
        const sheet = document.querySelector(".paper-sheet");
        if (sheet) seen.push(getComputedStyle(sheet).animationName);
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Deadlines" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Deadlines" })).toBeVisible();
    const seen = await page.evaluate(() => (window as unknown as { seen: string[] }).seen);
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set([reducedMotion === "reduce" ? "none" : "paper-0"]));
    await context.close();
  }
});
