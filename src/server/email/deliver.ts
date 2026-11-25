import { and, count, eq, gt, sql } from "drizzle-orm";
import { withSystem } from "@/db/system";
import { emailMessages } from "@/db/schema";
import { one } from "@/lib/one";
import { env } from "../env";
import type { EmailContent } from "./templates";

export type EmailKind = "invite" | "password_reset" | "sign_in_link" | "alert";
export type Outgoing = EmailContent & { kind: EmailKind; to: string; idempotencyKey: string };

const hourlyLimit = 3;

export async function recentlySent(kind: EmailKind, to: string): Promise<boolean> {
  const rows = await withSystem((tx) =>
    tx
      .select({ n: count() })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.kind, kind),
          eq(emailMessages.toEmail, to),
          gt(emailMessages.createdAt, new Date(Date.now() - 3_600_000)),
        ),
      ),
  );
  return one(rows).n >= hourlyLimit;
}

async function sendWithResend(message: Outgoing, idempotencyKey: string): Promise<string> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env().RESEND_API_KEY}`,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    },
    body: JSON.stringify({ from: env().EMAIL_FROM, to: message.to, subject: message.subject, html: message.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend returned ${response.status}`);
  const body = (await response.json()) as { id?: string };
  if (!body.id) throw new Error("Resend returned no message id");
  return body.id;
}

export async function deliver(message: Outgoing): Promise<string> {
  const outbox = env().EMAIL_MODE === "outbox";
  const rows = await withSystem((tx) =>
    tx
      .insert(emailMessages)
      .values({
        kind: message.kind,
        toEmail: message.to,
        subject: message.subject,
        bodyHtml: outbox ? message.html : null,
        status: outbox ? "suppressed" : "queued",
      })
      .returning({ id: emailMessages.id }),
  );
  const id = one(rows).id;
  if (outbox) return id;
  try {
    const providerId = await sendWithResend(message, message.idempotencyKey);
    await withSystem((tx) =>
      tx
        .update(emailMessages)
        .set({ status: "sent", providerId, sentAt: new Date(), attempts: sql`${emailMessages.attempts} + 1` })
        .where(eq(emailMessages.id, id)),
    );
    return id;
  } catch (error) {
    await withSystem((tx) =>
      tx
        .update(emailMessages)
        .set({ status: "failed", error: String(error).slice(0, 500), attempts: sql`${emailMessages.attempts} + 1` })
        .where(eq(emailMessages.id, id)),
    );
    throw error;
  }
}
