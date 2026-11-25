import { and, eq } from "drizzle-orm";
import { withSystem } from "@/db/system";
import { users } from "@/db/schema";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "viewer";
  canViewPayroll: boolean;
};

export async function loadCurrentUser(userId: string, sessionVersion: number): Promise<CurrentUser | undefined> {
  const [row] = await withSystem((tx) =>
    tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        canViewPayroll: users.canViewPayroll,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.status, "active"), eq(users.sessionVersion, sessionVersion))),
  );
  return row;
}
