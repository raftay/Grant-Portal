import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { users } from "@/db/schema";
import { inviteInput, role as roleField } from "@/lib/validation/users";
import { one } from "@/lib/one";
import { sendInvite } from "../auth/accounts";
import { notFound } from "../errors";
import { asAdmin, asMember, type Identity } from "./identity";

export const seatLimit = 5;

const columns = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  status: users.status,
  canViewPayroll: users.canViewPayroll,
};

export function listUsers(identity: Identity) {
  return asMember(identity, async (tx) => {
    const people = await tx.select(columns).from(users).orderBy(asc(users.name));
    return {
      people,
      seatsUsed: people.filter((person) => person.status !== "deactivated").length,
      payrollUsers: people.filter((person) => person.status === "active" && person.canViewPayroll).length,
    };
  });
}

export function listOwners(identity: Identity) {
  return asMember(identity, (tx) =>
    tx.select({ id: users.id, name: users.name }).from(users).where(eq(users.status, "active")).orderBy(asc(users.name)),
  );
}

export async function inviteUser(identity: Identity, input: z.input<typeof inviteInput>): Promise<string> {
  const { name, email, role } = inviteInput.parse(input);
  const id = await asAdmin(identity, async (tx) => {
    const result = await tx.execute<{ id: string }>(
      sql`insert into users (name, email, role, status) values (${name}, ${email}, ${role}, 'invited') returning id`,
    );
    return one(result.rows).id;
  });
  await sendInvite(id);
  return id;
}

export async function resendInvite(identity: Identity, userId: string): Promise<void> {
  const id = z.uuid().parse(userId);
  await asAdmin(identity, async () => undefined);
  await sendInvite(id);
}

type Change = Partial<Pick<typeof users.$inferInsert, "role" | "status" | "canViewPayroll">>;

function change(identity: Identity, userId: string, values: Change) {
  const id = z.uuid().parse(userId);
  return asAdmin(identity, async (tx) => {
    const updated = await tx.update(users).set(values).where(eq(users.id, id)).returning({ id: users.id });
    if (updated.length === 0) throw notFound("That person");
  });
}

export const changeRole = (identity: Identity, userId: string, role: z.input<typeof roleField>) =>
  change(identity, userId, { role: roleField.parse(role) });

export const setPayrollAccess = (identity: Identity, userId: string, allowed: boolean) =>
  change(identity, userId, { canViewPayroll: z.boolean().parse(allowed) });

export const deactivateUser = (identity: Identity, userId: string) => change(identity, userId, { status: "deactivated" });

export function reactivateUser(identity: Identity, userId: string) {
  const id = z.uuid().parse(userId);
  return asAdmin(identity, async (tx) => {
    const updated = await tx
      .update(users)
      .set({ status: sql`(case when ${users.emailVerified} is null then 'invited' else 'active' end)::user_status` })
      .where(sql`${users.id} = ${id} and ${users.status} = 'deactivated'`)
      .returning({ id: users.id });
    if (updated.length === 0) throw notFound("That deactivated person");
  });
}
