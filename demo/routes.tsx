import type { ReactNode } from "react";
import AuthLayout from "../src/app/(auth)/layout";
import AcceptInvite from "../src/app/(auth)/accept-invite/[token]/page";
import ForgotPassword from "../src/app/(auth)/forgot-password/page";
import Login from "../src/app/(auth)/login/page";
import ResetPassword from "../src/app/(auth)/reset-password/[token]/page";
import PortalLayout from "../src/app/(portal)/layout";
import Deadlines from "../src/app/(portal)/deadlines/page";
import Document from "../src/app/(portal)/documents/[id]/page";
import Contract from "../src/app/(portal)/grants/[id]/contract/page";
import ContractReview from "../src/app/(portal)/grants/[id]/contract/[extractionId]/page";
import Contacts from "../src/app/(portal)/grants/[id]/contacts/page";
import GrantDeadlines from "../src/app/(portal)/grants/[id]/deadlines/page";
import GrantDocuments from "../src/app/(portal)/grants/[id]/documents/page";
import EditGrant from "../src/app/(portal)/grants/[id]/edit/page";
import Grant from "../src/app/(portal)/grants/[id]/page";
import NewGrant from "../src/app/(portal)/grants/new/page";
import Grants from "../src/app/(portal)/grants/page";
import Missing from "../src/app/(portal)/not-found";
import Library from "../src/app/(portal)/organisation/documents/page";
import EditOrganisation from "../src/app/(portal)/organisation/edit/page";
import Organisation from "../src/app/(portal)/organisation/page";
import Home from "../src/app/(portal)/page";
import Audit from "../src/app/(portal)/settings/audit/page";
import Outbox from "../src/app/(portal)/settings/outbox/page";
import People from "../src/app/(portal)/settings/people/page";
import { DemoAccounts } from "./accounts";
import { followLink } from "./shims/auth-config";
import { NotFound, redirect } from "./shims/navigation";

type Values = Record<string, string>;
type Screen = (props: { params: Promise<never>; searchParams: Promise<never> }) => ReactNode | Promise<ReactNode>;

const portal: [string, unknown][] = [
  ["/", Home],
  ["/organisation", Organisation],
  ["/organisation/edit", EditOrganisation],
  ["/organisation/documents", Library],
  ["/documents/:id", Document],
  ["/grants", Grants],
  ["/grants/new", NewGrant],
  ["/grants/:id", Grant],
  ["/grants/:id/edit", EditGrant],
  ["/grants/:id/documents", GrantDocuments],
  ["/grants/:id/deadlines", GrantDeadlines],
  ["/grants/:id/contacts", Contacts],
  ["/grants/:id/contract", Contract],
  ["/grants/:id/contract/:extractionId", ContractReview],
  ["/deadlines", Deadlines],
  ["/settings/people", People],
  ["/settings/audit", Audit],
  ["/settings/outbox", Outbox],
];

const open: [string, unknown][] = [
  ["/login", Login],
  ["/forgot-password", ForgotPassword],
  ["/reset-password/:token", ResetPassword],
  ["/accept-invite/:token", AcceptInvite],
];

function match(pattern: string, path: string): Values | undefined {
  const wanted = pattern.split("/");
  const given = path.split("/");
  if (wanted.length !== given.length) return undefined;
  const values: Values = {};
  for (const [index, part] of wanted.entries()) {
    const value = given[index]!;
    if (part.startsWith(":")) values[part.slice(1)] = decodeURIComponent(value);
    else if (part !== value) return undefined;
  }
  return values;
}

function pick(routes: [string, unknown][], path: string): { screen: Screen; params: Values } | undefined {
  for (const [pattern, screen] of routes) {
    const params = match(pattern, path);
    if (params) return { screen: screen as Screen, params };
  }
  return undefined;
}

const call = ({ screen, params }: { screen: Screen; params: Values }, search: Values) =>
  screen({ params: Promise.resolve(params) as Promise<never>, searchParams: Promise.resolve(search) as Promise<never> });

export async function render(address: string): Promise<ReactNode> {
  const url = new URL(address, location.origin);
  const search = Object.fromEntries(url.searchParams);
  if (url.pathname.startsWith("/link/")) redirect((await followLink(url.pathname.slice(6))) ? "/" : "/login?error=Verification");
  const outside = pick(open, url.pathname);
  if (outside) {
    const content = await call(outside, search);
    return (
      <AuthLayout>
        {content}
        {url.pathname === "/login" && <DemoAccounts />}
      </AuthLayout>
    );
  }
  const inside = pick(portal, url.pathname);
  let content: ReactNode = <Missing />;
  try {
    if (inside) content = await call(inside, search);
  } catch (error) {
    if (!(error instanceof NotFound)) throw error;
  }
  return PortalLayout({ children: content });
}
