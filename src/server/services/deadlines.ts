import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { deadlines, grants, recentActivity, users } from "@/db/schema";
import { deadlineState } from "@/lib/dates";
import { one } from "@/lib/one";
import { deadlineFilter, deadlineInput } from "@/lib/validation/deadlines";
import { notFound } from "../errors";
import { asMember, asWriter, type Identity } from "./identity";
import { organizationToday } from "./organization";
import { requireActiveOwner } from "./owners";

export function listDeadlines(identity: Identity, filter: z.input<typeof deadlineFilter>) {
  const by = deadlineFilter.parse(filter);
  return asMember(identity, async (tx) => {
    const today = await organizationToday(tx);
    const rows = await tx
      .select({
        id: deadlines.id,
        grantId: deadlines.grantId,
        grantName: grants.name,
        type: deadlines.type,
        title: deadlines.title,
        description: deadlines.description,
        dueOn: deadlines.dueOn,
        ownerId: deadlines.ownerId,
        ownerName: users.name,
        status: deadlines.status,
        reminderDays: deadlines.reminderDays,
        origin: deadlines.origin,
        completedAt: deadlines.completedAt,
        updatedAt: deadlines.updatedAt,
      })
      .from(deadlines)
      .innerJoin(grants, eq(grants.id, deadlines.grantId))
      .leftJoin(users, eq(users.id, deadlines.ownerId))
      .where(
        and(
          by.grantId ? eq(deadlines.grantId, by.grantId) : undefined,
          by.ownerId ? eq(deadlines.ownerId, by.ownerId) : undefined,
          by.type ? eq(deadlines.type, by.type) : undefined,
          by.status ? eq(deadlines.status, by.status) : undefined,
        ),
      )
      .orderBy(asc(deadlines.dueOn), asc(deadlines.title));
    const edits = await tx
      .selectDistinctOn([recentActivity.entityId], {
        entityId: recentActivity.entityId,
        by: recentActivity.actorName,
        at: recentActivity.occurredAt,
      })
      .from(recentActivity)
      .where(eq(recentActivity.entityType, "deadlines"))
      .orderBy(recentActivity.entityId, desc(recentActivity.id));
    const lastEdits = new Map(edits.map((edit) => [edit.entityId, { by: edit.by, at: edit.at }]));
    return rows.map((row) => ({ ...row, state: deadlineState(row, today), lastEdit: lastEdits.get(row.id) }));
  });
}

export function createDeadline(identity: Identity, input: z.input<typeof deadlineInput>): Promise<string> {
  const values = deadlineInput.parse(input);
  const done = values.status === "completed";
  return asWriter(identity, async (tx) => {
    await requireActiveOwner(tx, values.ownerId);
    const created = await tx
      .insert(deadlines)
      .values({ ...values, completedAt: done ? new Date() : null, completedBy: done ? identity.userId : null })
      .returning({ id: deadlines.id });
    return one(created).id;
  });
}

export function updateDeadline(identity: Identity, deadlineId: string, input: z.input<typeof deadlineInput>): Promise<void> {
  const id = z.uuid().parse(deadlineId);
  const values = deadlineInput.parse(input);
  const done = values.status === "completed";
  return asWriter(identity, async (tx) => {
    const [existing] = await tx.select().from(deadlines).where(eq(deadlines.id, id)).for("update");
    if (!existing) throw notFound("That deadline");
    if (existing.ownerId !== values.ownerId) await requireActiveOwner(tx, values.ownerId);
    const unchanged = done && existing.status === "completed";
    const completion = unchanged
      ? {}
      : { completedAt: done ? new Date() : null, completedBy: done ? identity.userId : null };
    await tx
      .update(deadlines)
      .set({ ...values, ...completion })
      .where(eq(deadlines.id, id));
  });
}
