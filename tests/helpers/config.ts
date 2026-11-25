const base = process.env.TEST_DATABASE_OWNER_URL ?? "postgres://owner:owner@127.0.0.1:54329/grant_portal";

function swap(user: string | null, password: string | null, name: string): string {
  const url = new URL(base);
  if (user) url.username = user;
  if (password) url.password = password;
  url.pathname = `/${name}`;
  return url.toString();
}

export const testDatabase = "grant_portal_test";
export const templateDatabase = "grant_portal_template";
export const adminUrl = base;
export const urlFor = swap;
export const ownerUrl = swap(null, null, testDatabase);
export const userUrl = swap("app_user", "app_user", testDatabase);
export const systemUrl = swap("app_system", "app_system", testDatabase);
