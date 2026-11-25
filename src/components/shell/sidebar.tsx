"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CalendarDays, FolderClosed, History, House, Inbox, Menu, SlidersHorizontal, X } from "lucide-react";
import { cn } from "cn";

export type NavGrant = { id: string; name: string };

type Props = { organization: string; grants: NavGrant[]; person: string; isAdmin: boolean; outbox: boolean; sampleData: boolean; signOut: ReactNode };

function Item({ href, icon, label, active }: { href: string; icon: ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex min-h-10 items-center gap-2 rounded-lg px-2.5 whitespace-nowrap [&_svg]:size-[18px] [&_svg]:shrink-0", active ? "bg-mint font-semibold text-primary" : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground")}
    >
      {icon}
      {label}
    </Link>
  );
}

const Brand = () => (
  <Link href="/" className="flex items-center gap-2.5 text-[19px] font-bold">
    <FolderClosed className="size-6 text-primary" aria-hidden="true" />
    Grant Portal
  </Link>
);

function Contents({ organization, grants, person, isAdmin, outbox, sampleData, signOut }: Props) {
  const path = usePathname();
  return (
    <div className="flex min-h-full flex-col gap-2 p-4">
      <div className="hidden py-3 lg:block">
        <Brand />
      </div>
      <div className="rounded-lg bg-muted p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase">{sampleData ? "Demo organisation" : "Organisation"}</p>
        <p className="font-semibold">{organization}</p>
      </div>
      <nav aria-label="Main" className="mt-2 flex flex-col gap-1">
        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Workspace</p>
        <Item href="/" icon={<House />} label="Organisation home" active={path === "/" || path.startsWith("/organisation") || path.startsWith("/documents")} />
        <Item href="/deadlines" icon={<CalendarDays />} label="Deadlines" active={path === "/deadlines"} />
        <div className="mt-5 mb-1 flex justify-between text-xs font-medium text-muted-foreground uppercase">
          <Link href="/grants" className="hover:text-foreground">Your grants</Link>
          <span>{grants.length}</span>
        </div>
        {grants.map((grant, index) => {
          const active = path.startsWith(`/grants/${grant.id}`);
          return (
            <Link
              key={grant.id}
              href={`/grants/${grant.id}`}
              aria-current={active ? "page" : undefined}
              className={cn("flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-[13px]", active ? "bg-mint font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <span className="text-xs tabular-nums">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0 truncate">{grant.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-1 pt-8">
        {isAdmin && <Item href="/settings/people" icon={<SlidersHorizontal />} label="People & permissions" active={path === "/settings/people"} />}
        {isAdmin && <Item href="/settings/audit" icon={<History />} label="Audit log" active={path === "/settings/audit"} />}
        {isAdmin && outbox && <Item href="/settings/outbox" icon={<Inbox />} label="Demo inbox" active={path === "/settings/outbox"} />}
        <p className="mt-3 font-semibold">{person}</p>
        {signOut}
      </div>
    </div>
  );
}

export function Sidebar(props: Props) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const [shownPath, setShownPath] = useState(path);
  if (shownPath !== path) {
    setShownPath(path);
    setOpen(false);
  }
  const tabs = [
    { href: "/", label: "Home", icon: <House />, active: path === "/" },
    { href: "/grants", label: "Grants", icon: <FolderClosed />, active: path.startsWith("/grants") },
    { href: "/deadlines", label: "Deadlines", icon: <CalendarDays />, active: path === "/deadlines" },
  ];
  return (
    <>
      <aside className="hidden w-[216px] shrink-0 bg-card lg:block">
        <div className="sticky top-0 h-dvh overflow-y-auto">
          <Contents {...props} />
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-3 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="grid size-11 place-items-center rounded-lg hover:bg-muted">
          <Menu className="size-5" />
        </button>
        <Brand />
      </header>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu" onKeyDown={(event) => event.key === "Escape" && setOpen(false)}>
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/45" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[290px] max-w-[85vw] overflow-y-auto bg-card">
            <div className="flex items-center justify-between px-4 pt-3">
              <Brand />
              <button type="button" autoFocus onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-11 place-items-center rounded-lg hover:bg-muted">
                <X className="size-5" />
              </button>
            </div>
            <Contents {...props} />
          </div>
        </div>
      )}
      <nav aria-label="Quick links" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={tab.active ? "page" : undefined} className={cn("flex min-h-16 flex-col items-center justify-center gap-1 text-xs [&_svg]:size-5", tab.active ? "font-semibold text-primary" : "text-muted-foreground")}>
            {tab.icon}
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
