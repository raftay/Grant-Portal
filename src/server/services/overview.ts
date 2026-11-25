import { and, asc, between, count, desc, eq, inArray, isNull, lt, lte, or, sql, sum } from "drizzle-orm";
import { z } from "zod";
import { auditLog, deadlines, documents, emailMessages, grants, recentActivity, users } from "@/db/schema";
import { addDays, deadlineState, documentState } from "@/lib/dates";
import { one } from "@/lib/one";
import { asAdmin, asMember, type Identity } from "./identity";
import { organizationToday } from "./organization";
import { spending } from "./grants";

const openStatuses: ("open" | "in_progress")[] = ["open", "in_progress"];

export function listAttention(identity: Identity) {
  return asMember(identity, async (tx) => {
    const today = await organizationToday(tx);
    const horizon = addDays(today, 30);
    const documentRows = await tx
      .select({
        id: documents.id,
        title: documents.title,
        grantId: documents.grantId,
        expiresOn: documents.expiresOn,
        reviewOn: documents.reviewOn,
        ownerName: users.name,
      })
      .from(documents)
      .leftJoin(users, eq(users.id, documents.ownerId))
      .where(and(isNull(documents.archivedAt), or(lte(documents.expiresOn, horizon), lte(documents.reviewOn, horizon))));
    const deadlineRows = await tx
      .select({
        id: deadlines.id,
        title: deadlines.title,
        grantId: deadlines.grantId,
        dueOn: deadlines.dueOn,
        status: deadlines.status,
        reminderDays: deadlines.reminderDays,
        ownerName: users.name,
      })
      .from(deadlines)
      .leftJoin(users, eq(users.id, deadlines.ownerId))
      .where(and(inArray(deadlines.status, openStatuses), sql`${deadlines.dueOn} - ${deadlines.reminderDays} <= ${today}::date`));
    const items = [
      ...documentRows.map((row) => {
        const state = documentState(row, today);
        const dueOn = state === "expired" || state === "expiring" ? row.expiresOn : row.reviewOn;
        if (!dueOn) throw new Error("A document needing attention has no date");
        return { kind: "document" as const, id: row.id, title: row.title, grantId: row.grantId, ownerName: row.ownerName, state, dueOn };
      }),
      ...deadlineRows.map((row) => ({
        kind: "deadline" as const,
        id: row.id,
        title: row.title,
        grantId: row.grantId,
        ownerName: row.ownerName,
        state: deadlineState(row, today),
        dueOn: row.dueOn,
      })),
    ];
    return items.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title));
  });
}

export function getSummary(identity: Identity) {
  return asMember(identity, async (tx) => {
    const today = await organizationToday(tx);
    const active = one(
      await tx.select({ n: count(), cents: sum(grants.awardCents).mapWith(Number) }).from(grants).where(eq(grants.status, "active")),
    );
    const upcoming = one(
      await tx
        .select({ n: count() })
        .from(deadlines)
        .where(and(inArray(deadlines.status, openStatuses), between(deadlines.dueOn, today, addDays(today, 30)))),
    );
    return { activeGrants: active.n, awardedCents: active.n === 0 ? 0 : active.cents, deadlinesWithin30Days: upcoming.n, spending };
  });
}

export function listActivity(identity: Identity, limit: number) {
  const size = z.number().int().min(1).max(50).parse(limit);
  return asMember(identity, (tx) => tx.select().from(recentActivity).orderBy(desc(recentActivity.id)).limit(size));
}

const auditFilter = z.object({
  entityType: z.string().max(60).optional(),
  actorId: z.uuid().optional(),
  grantId: z.uuid().optional(),
  before: z.number().int().positive().optional(),
});

export function listAudit(identity: Identity, filter: z.input<typeof auditFilter>) {
  const by = auditFilter.parse(filter);
  return asAdmin(identity, (tx) =>
    tx
      .select({
        id: auditLog.id,
        occurredAt: auditLog.occurredAt,
        actorKind: auditLog.actorKind,
        actorName: users.name,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        grantId: auditLog.grantId,
        before: auditLog.before,
        after: auditLog.after,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(
        and(
          by.entityType ? eq(auditLog.entityType, by.entityType) : undefined,
          by.actorId ? eq(auditLog.actorId, by.actorId) : undefined,
          by.grantId ? eq(auditLog.grantId, by.grantId) : undefined,
          by.before ? lt(auditLog.id, by.before) : undefined,
        ),
      )
      .orderBy(desc(auditLog.id))
      .limit(50),
  );
}

export function listAccessChanges(identity: Identity) {
  return asAdmin(identity, (tx) =>
    tx
      .select({ id: auditLog.id, occurredAt: auditLog.occurredAt, actorName: users.name, before: auditLog.before, after: auditLog.after })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorId))
      .where(and(eq(auditLog.entityType, "users"), inArray(auditLog.action, ["insert", "update"])))
      .orderBy(desc(auditLog.id))
      .limit(10),
  );
}

export function listEmails(identity: Identity) {
  return asAdmin(identity, (tx) => tx.select().from(emailMessages).orderBy(desc(emailMessages.createdAt), asc(emailMessages.id)).limit(100));
}
