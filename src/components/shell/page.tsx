import Link from "next/link";
import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import { cn } from "cn";
import { ToneBadge } from "@/components/badges";
import { env } from "@/server/env";

type Tab = { href: string; label: string; active: boolean };

export function Page({ crumb, eyebrow, title, lead, actions, tabs, children }: { crumb: string; eyebrow: ReactNode; title: ReactNode; lead?: ReactNode; actions?: ReactNode; tabs?: Tab[]; children: ReactNode }) {
  return (
    <>
      <header className="hidden min-h-[72px] items-center justify-between gap-4 bg-card px-8 lg:flex">
        <p className="text-muted-foreground">{crumb}</p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {env().SAMPLE_DATA === "true" && <ToneBadge tone="mint">Sample data</ToneBadge>}
          <span className="flex items-center gap-2">
            <LockKeyhole className="size-4" aria-hidden="true" /> Private workspace
          </span>
        </div>
      </header>
      <main id="content" className="flex flex-col gap-6 px-4 pt-6 pb-28 sm:px-8 sm:pt-8 lg:pb-16">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{eyebrow}</p>
            <h1 className="mt-1 text-[26px] leading-tight font-semibold text-balance sm:text-[30px]">{title}</h1>
            {lead && <p className="mt-2 text-muted-foreground">{lead}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
        </div>
        {tabs && (
          <nav aria-label="Sections" className="-mt-1 flex gap-6 overflow-x-auto">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={cn("border-b-2 py-2 font-medium whitespace-nowrap", tab.active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
        {children}
      </main>
    </>
  );
}

export const grantTabs = (id: string, active: "overview" | "documents" | "deadlines" | "contacts"): Tab[] => [
  { href: `/grants/${id}`, label: "Overview", active: active === "overview" },
  { href: `/grants/${id}/documents`, label: "Documents", active: active === "documents" },
  { href: `/grants/${id}/deadlines`, label: "Deadlines", active: active === "deadlines" },
  { href: `/grants/${id}/contacts`, label: "Contacts & links", active: active === "contacts" },
];
