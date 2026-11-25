import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { runAlerts } from "@/app/actions/records";
import { ToneBadge } from "@/components/badges";
import { ActionButton } from "@/components/forms/quick";
import { Empty, Notice, Panel } from "@/components/panels";
import { Page } from "@/components/shell/page";
import { formatMoment } from "@/lib/format";
import { env } from "@/server/env";
import { adminContext } from "@/server/page";
import { getOrganization } from "@/server/services/organization";
import { listEmails } from "@/server/services/overview";

export const metadata: Metadata = { title: "Demo inbox" };

function linkIn(html: string): string {
  const match = /href="([^"]+)"/.exec(html);
  if (!match?.[1]) throw new Error("The email has no link");
  return match[1].replaceAll("&amp;", "&");
}

export default async function OutboxPage() {
  const { identity } = await adminContext();
  if (env().EMAIL_MODE !== "outbox") notFound();
  const [emails, profile] = await Promise.all([listEmails(identity), getOrganization(identity)]);
  return (
    <Page crumb="Settings / Demo inbox" eyebrow="Admin settings" title="Demo inbox" lead="Emails the portal would have sent." actions={<ActionButton action={runAlerts} values={{}} label="Run alerts now" pendingLabel="Running" variant="default" />}>
      <Notice tone="warn" title="Demo only">This inbox shows sign-in, invitation and reset links to admins. Turn it off before using real accounts.</Notice>
      <Panel>
        {emails.length === 0 ? (
          <Empty>No emails yet.</Empty>
        ) : (
          <ul>
            {emails.map((email) => (
              <li key={email.id} className="border-b py-3 last:border-0">
                <details>
                  <summary className="flex cursor-pointer flex-wrap justify-between gap-x-4 gap-y-1">
                    <span className="font-medium">{email.subject}</span>
                    <span className="text-muted-foreground">{email.toEmail} · {formatMoment(email.createdAt, profile.timezone)}</span>
                  </summary>
                  <div className="mt-3 flex flex-col items-start gap-3">
                    <ToneBadge tone="plain">{email.kind.replaceAll("_", " ")}</ToneBadge>
                    {email.bodyHtml && (
                      <>
                        <iframe srcDoc={email.bodyHtml} sandbox="" title={email.subject} className="h-64 w-full rounded-lg border bg-white" />
                        <a href={linkIn(email.bodyHtml)} className="font-semibold text-primary hover:underline">Open the link in this email</a>
                      </>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </Page>
  );
}
