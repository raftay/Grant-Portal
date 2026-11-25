import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { withSystem } from "@/db/system";
import { deadlines, documents, files, grants, notifications, users } from "@/db/schema";
import { addDays, daysBetween } from "@/lib/dates";
import { deliver } from "../email/deliver";
import { alertEmail } from "../email/templates";
import { env } from "../env";
import { organizationToday } from "../services/organization";
import { removeObject } from "../storage/storage";

type Milestone = "30d" | "reminder" | "overdue";

type Alert = {
  kind: "doc_expiry" | "doc_review" | "deadline";
  subjectId: string;
  title: string;
  grantName: string | null;
  dueOn: string;
  milestone: Milestone;
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
  path: string;
};

async function findAlerts(now: Date): Promise<Alert[]> {
  return withSystem(async (tx) => {
    const today = await organizationToday(tx, now);
    const horizon = addDays(today, 30);
    const owner = alias(users, "owner");
    const recipient = { recipientId: owner.id, recipientName: owner.name, recipientEmail: owner.email };

    const documentRows = await tx
      .select({ id: documents.id, title: documents.title, grantName: grants.name, expiresOn: documents.expiresOn, reviewOn: documents.reviewOn, ...recipient })
      .from(documents)
      .innerJoin(owner, and(eq(owner.id, documents.ownerId), eq(owner.status, "active")))
      .leftJoin(grants, eq(grants.id, documents.grantId))
      .where(and(isNull(documents.archivedAt), or(lte(documents.expiresOn, horizon), lte(documents.reviewOn, horizon))));

    const deadlineRows = await tx
      .select({ id: deadlines.id, title: deadlines.title, grantName: grants.name, dueOn: deadlines.dueOn, reminderDays: deadlines.reminderDays, ...recipient })
      .from(deadlines)
      .innerJoin(owner, and(eq(owner.id, deadlines.ownerId), eq(owner.status, "active")))
      .innerJoin(grants, eq(grants.id, deadlines.grantId))
      .where(inArray(deadlines.status, ["open", "in_progress"]));

    const alerts: Alert[] = [];
    for (const { id, expiresOn, reviewOn, ...row } of documentRows) {
      const dates = [
        { kind: "doc_expiry" as const, dueOn: expiresOn },
        { kind: "doc_review" as const, dueOn: reviewOn },
      ];
      for (const { kind, dueOn } of dates) {
        if (!dueOn || dueOn > horizon) continue;
        alerts.push({ ...row, kind, dueOn, subjectId: id, milestone: dueOn < today ? "overdue" : "30d", path: `/documents/${id}` });
      }
    }
    for (const { id, reminderDays, ...row } of deadlineRows) {
      const days = daysBetween(today, row.dueOn);
      if (days > reminderDays) continue;
      alerts.push({ ...row, kind: "deadline", subjectId: id, milestone: days < 0 ? "overdue" : "reminder", path: "/deadlines" });
    }
    return alerts;
  });
}

async function sendAlert(alert: Alert): Promise<boolean> {
  const dedupeKey = [alert.kind, alert.subjectId, alert.dueOn, alert.milestone, alert.recipientId].join(":");
  return withSystem(async (tx) => {
    const claimed = await tx
      .insert(notifications)
      .values({
        kind: alert.kind,
        recipientId: alert.recipientId,
        documentId: alert.kind === "deadline" ? null : alert.subjectId,
        deadlineId: alert.kind === "deadline" ? alert.subjectId : null,
        dueOn: alert.dueOn,
        milestone: alert.milestone,
        dedupeKey,
      })
      .onConflictDoNothing({ target: notifications.dedupeKey })
      .returning({ id: notifications.id });
    const [notification] = claimed;
    if (!notification) return false;
    const emailMessageId = await deliver({
      kind: "alert",
      to: alert.recipientEmail,
      idempotencyKey: dedupeKey,
      ...alertEmail({ ...alert, link: `${env().APP_URL}${alert.path}` }),
    });
    await tx.update(notifications).set({ emailMessageId }).where(eq(notifications.id, notification.id));
    return true;
  });
}

async function discardStaleUploads(now: Date): Promise<number> {
  const stale = await withSystem((tx) =>
    tx
      .update(files)
      .set({ status: "failed" })
      .where(and(eq(files.status, "pending"), lt(files.createdAt, new Date(now.getTime() - 86_400_000))))
      .returning({ storageKey: files.storageKey }),
  );
  for (const { storageKey } of stale) await removeObject(`incoming/${storageKey}`);
  return stale.length;
}

export async function runDaily(now: Date = new Date()): Promise<{ sent: number; alreadySent: number; uploadsDiscarded: number }> {
  let sent = 0;
  let alreadySent = 0;
  for (const alert of await findAlerts(now)) {
    if (await sendAlert(alert)) sent += 1;
    else alreadySent += 1;
  }
  const result = { sent, alreadySent, uploadsDiscarded: await discardStaleUploads(now) };
  await withSystem((tx) =>
    tx.execute(sql`select app.log_event('job.daily_completed', 'jobs', null, null, ${JSON.stringify(result)}::jsonb)`),
  );
  return result;
}
