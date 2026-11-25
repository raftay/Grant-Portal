import { cache } from "react";
import { redirect } from "next/navigation";
import { loadCurrentUser, type CurrentUser } from "./access";
import { auth } from "./config";

export const currentUser = cache(async (): Promise<CurrentUser | undefined> => {
  const session = (await auth()) as { user?: { id?: string }; sessionVersion?: unknown } | null;
  if (!session?.user?.id || typeof session.sessionVersion !== "number") return undefined;
  return loadCurrentUser(session.user.id, session.sessionVersion);
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
