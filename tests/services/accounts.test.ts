import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ids as i } from "../helpers/fixtures";
import { prepareServices } from "../helpers/services";

let env: Awaited<ReturnType<typeof prepareServices>>;
let accounts: typeof import("@/server/auth/accounts");
let people: typeof import("@/server/services/users");
let signIn: typeof import("@/server/auth/sign-in");
let access: typeof import("@/server/auth/access");
let passwords: typeof import("@/server/auth/password");
let config: typeof import("@/server/auth/config");
let adapterModule: typeof import("@/server/auth/adapter");

const admin = { userId: i.admin };
const good = "correct horse battery staple";

beforeAll(async () => {
  env = await prepareServices();
  accounts = await import("@/server/auth/accounts");
  people = await import("@/server/services/users");
  signIn = await import("@/server/auth/sign-in");
  access = await import("@/server/auth/access");
  passwords = await import("@/server/auth/password");
  adapterModule = await import("@/server/auth/adapter");
  config = await import("@/server/auth/config");
});
afterAll(() => env.close());

async function lastLink(to: string): Promise<string> {
  const [row] = await env.query<{ body_html: string }>(
    "select body_html from email_messages where to_email = $1 order by created_at desc limit 1",
    [to],
  );
  return row!.body_html.match(/href="https:\/\/portal\.example\.org\/[a-z-]+\/([\w-]+)"/)![1]!;
}

const version = async (id: string) =>
  (await env.query<{ session_version: number }>("select session_version from users where id = $1", [id]))[0]!.session_version;

describe("passwords", () => {
  it("hashes with a fresh salt and verifies", async () => {
    const [first, second] = [await passwords.hashPassword(good), await passwords.hashPassword(good)];
    expect(first).not.toBe(second);
    expect(await passwords.verifyPassword(good, first)).toBe(true);
    expect(await passwords.verifyPassword(`${good}x`, first)).toBe(false);
    await expect(passwords.verifyPassword(good, "nonsense")).rejects.toThrow("malformed");
  });
});

describe("invitations", () => {
  it("is refused to staff, viewers, deactivated people and strangers", async () => {
    for (const userId of [i.staff, i.viewer, i.deactivated, "00000000-0000-4000-8000-00000000ffff"]) {
      await expect(people.inviteUser({ userId }, { name: "N", email: "n@example.org", role: "admin" })).rejects.toMatchObject({ code: "forbidden" });
      await expect(people.changeRole({ userId }, i.viewer, "admin")).rejects.toMatchObject({ code: "forbidden" });
      await expect(people.setPayrollAccess({ userId }, userId, true)).rejects.toMatchObject({ code: "forbidden" });
      await expect(people.resendInvite({ userId }, i.staff)).rejects.toMatchObject({ code: "forbidden" });
      await expect(people.reactivateUser({ userId }, i.deactivated)).rejects.toMatchObject({ code: "forbidden" });
    }
  });

  it("explains a full house", async () => {
    await expect(people.inviteUser(admin, { name: "N", email: "n@example.org", role: "staff" })).rejects.toMatchObject({
      code: "conflict",
      message: expect.stringContaining("All 5 accounts"),
    });
  });

  it("goes from invite to first sign-in, with a link that works once", async () => {
    await people.deactivateUser(admin, i.viewer);
    await people.deactivateUser(admin, i.viewerPay);
    const id = await people.inviteUser(admin, { name: "Nia", email: " NIA@Example.org ", role: "staff" });
    expect(await signIn.verifySignIn("nia@example.org", good, "1.1.1.1")).toBeUndefined();
    const first = await lastLink("nia@example.org");
    await people.resendInvite(admin, id);
    const token = await lastLink("nia@example.org");
    await expect(accounts.acceptInvite({ token: first, name: "Nia", password: good })).rejects.toMatchObject({ code: "invalid" });
    await expect(accounts.acceptInvite({ token, name: "Nia", password: "short" })).rejects.toThrow("12 characters");
    await accounts.acceptInvite({ token, name: "Nia B", password: good });
    await expect(accounts.acceptInvite({ token, name: "Nia", password: good })).rejects.toMatchObject({ code: "invalid" });
    expect(await signIn.verifySignIn("nia@example.org", good, "1.1.1.1")).toMatchObject({ id, name: "Nia B" });
    expect((await people.listUsers(admin)).seatsUsed).toBe(5);
    await expect(people.resendInvite(admin, id)).rejects.toMatchObject({ code: "conflict" });
  });

  it("refuses a duplicate email in any case", async () => {
    await people.deactivateUser(admin, i.staffPay);
    await expect(people.inviteUser(admin, { name: "N", email: "Nia@EXAMPLE.org", role: "staff" })).rejects.toMatchObject({
      message: expect.stringContaining("email address"),
    });
  });

  it("does not let an invite link revive a deactivated person", async () => {
    const id = await people.inviteUser(admin, { name: "Gone", email: "gone@example.org", role: "staff" });
    const token = await lastLink("gone@example.org");
    await people.deactivateUser(admin, id);
    await expect(accounts.acceptInvite({ token, name: "Gone", password: good })).rejects.toMatchObject({ code: "invalid" });
    await people.reactivateUser(admin, id);
    expect((await people.listUsers(admin)).people.find((p) => p.id === id)?.status).toBe("invited");
    await people.deactivateUser(admin, id);
  });
});

describe("password reset", () => {
  it("says nothing about unknown or deactivated addresses", async () => {
    for (const email of ["stranger@example.org", "dee@example.org", "not an email"]) {
      expect(await accounts.requestPasswordReset(email)).toBeUndefined();
    }
    expect(await env.query("select 1 from email_messages where to_email in ('stranger@example.org', 'dee@example.org')")).toEqual([]);
  });

  it("changes the password once, ends sessions and is logged", async () => {
    const before = await version(i.staff);
    await accounts.requestPasswordReset("SAM@example.org");
    const token = await lastLink("sam@example.org");
    await accounts.resetPassword({ token, password: good });
    await expect(accounts.resetPassword({ token, password: "another long password" })).rejects.toMatchObject({ code: "invalid" });
    expect(await version(i.staff)).toBeGreaterThan(before);
    expect(await access.loadCurrentUser(i.staff, before)).toBeUndefined();
    expect(await signIn.verifySignIn("sam@example.org", good, "2.2.2.2")).toMatchObject({ id: i.staff });
    const log = await env.query<{ actor_id: string }>("select actor_id from audit_log where action = 'auth.password_reset'");
    expect(log).toEqual([{ actor_id: i.staff }]);
  });

  it("rejects expired and wrong-purpose tokens", async () => {
    await accounts.requestPasswordReset("sam@example.org");
    const token = await lastLink("sam@example.org");
    await expect(accounts.acceptInvite({ token, name: "Sam", password: good })).rejects.toMatchObject({ code: "invalid" });
    await env.query("update auth_tokens set expires_at = now() - interval '1 second' where used_at is null");
    await expect(accounts.resetPassword({ token, password: good })).rejects.toMatchObject({ code: "invalid" });
  });

  it("stops after three emails an hour", async () => {
    for (let n = 0; n < 5; n += 1) await accounts.requestPasswordReset("abe@example.org");
    expect(await env.query("select 1 from email_messages where to_email = 'abe@example.org'")).toHaveLength(3);
  });

  it("stores only token hashes", async () => {
    const token = await lastLink("sam@example.org");
    expect(await env.query("select 1 from auth_tokens where token_hash = $1", [token])).toEqual([]);
  });
});

describe("sign-in", () => {
  it("throttles one account, whatever the address", async () => {
    for (let n = 0; n < 5; n += 1) expect(await signIn.verifySignIn("sam@example.org", "wrong", `9.9.9.${n}`)).toBeUndefined();
    await expect(signIn.verifySignIn("sam@example.org", good, "8.8.8.8")).rejects.toMatchObject({ code: "throttled" });
    await env.query("delete from login_attempts");
  });

  it("throttles one address across accounts", async () => {
    for (let n = 0; n < 20; n += 1) await signIn.verifySignIn(`x${n}@example.org`, "wrong", "7.7.7.7");
    await expect(signIn.verifySignIn("sam@example.org", good, "7.7.7.7")).rejects.toMatchObject({ code: "throttled" });
    await env.query("delete from login_attempts");
  });

  it("holds the limit under parallel guesses", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => signIn.verifySignIn("sam@example.org", "wrong", "6.6.6.6")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    await env.query("delete from login_attempts");
  });

  it("refuses a deactivated person with the right password", async () => {
    await env.query("insert into user_credentials values ($1, $2)", [i.deactivated, await passwords.hashPassword(good)]);
    expect(await signIn.verifySignIn("dee@example.org", good, "5.5.5.5")).toBeUndefined();
  });
});

describe("sessions", () => {
  it.each([
    ["role change", () => people.changeRole(admin, i.staff, "viewer")],
    ["payroll change", () => people.setPayrollAccess(admin, i.staff, true)],
    ["deactivation", () => people.deactivateUser(admin, i.staff)],
  ])("end on %s", async (_label, act) => {
    const before = await version(i.staff);
    expect(await access.loadCurrentUser(i.staff, before)).toBeDefined();
    await act();
    expect(await access.loadCurrentUser(i.staff, before)).toBeUndefined();
  });

  it("keep the last admin in place", async () => {
    await people.deactivateUser(admin, i.adminPay);
    await expect(people.changeRole(admin, i.admin, "staff")).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("magic links", () => {
  const ask = (email: string) =>
    config.authConfig().callbacks!.signIn!({
      user: { email },
      account: { type: "email", provider: "email", providerAccountId: email },
      email: { verificationRequest: true },
    } as never);

  it("answers unknown and known addresses the same way outwardly", async () => {
    expect(await ask("abe@example.org")).toBe(true);
    expect(await ask("stranger@example.org")).toBe("/api/auth/verify-request?provider=email&type=email");
    expect(await ask("dee@example.org")).toBe("/api/auth/verify-request?provider=email&type=email");
  });

  it("never creates accounts", () => {
    expect(() => adapterModule.adapter.createUser!({} as never)).toThrow("invitation");
  });

  it("uses a token once", async () => {
    const token = { identifier: "abe@example.org", token: "hash", expires: new Date(Date.now() + 1000) };
    await adapterModule.adapter.createVerificationToken!(token);
    expect(await adapterModule.adapter.useVerificationToken!(token)).toMatchObject({ identifier: "abe@example.org" });
    expect(await adapterModule.adapter.useVerificationToken!(token)).toBeNull();
  });
});
