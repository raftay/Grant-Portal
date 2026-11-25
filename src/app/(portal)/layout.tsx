import type { ReactNode } from "react";
import { leave } from "@/app/actions/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { roleLabels } from "@/lib/labels";
import { env } from "@/server/env";
import { pageContext } from "@/server/page";
import { listGrants } from "@/server/services/grants";
import { getOrganization } from "@/server/services/organization";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const { user, identity, isAdmin } = await pageContext();
  const [organization, grants] = await Promise.all([getOrganization(identity), listGrants(identity)]);
  return (
    <div className="lg:flex">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2">
        Skip to content
      </a>
      <Sidebar
        organization={organization.legalName}
        grants={grants.filter((grant) => grant.status !== "closed").map(({ id, name }) => ({ id, name }))}
        person={`${user.name} · ${roleLabels[user.role]}`}
        isAdmin={isAdmin}
        outbox={env().EMAIL_MODE === "outbox"}
        sampleData={env().SAMPLE_DATA === "true"}
        signOut={
          <form action={leave}>
            <button type="submit" className="min-h-9 text-muted-foreground hover:text-foreground hover:underline">Sign out</button>
          </form>
        }
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
