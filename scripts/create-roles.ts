import { createRoles } from "./lib/database";

const url = process.env.DATABASE_OWNER_URL;
const userPassword = process.env.APP_USER_PASSWORD;
const systemPassword = process.env.APP_SYSTEM_PASSWORD;
if (!url || !userPassword || !systemPassword) {
  throw new Error("DATABASE_OWNER_URL, APP_USER_PASSWORD and APP_SYSTEM_PASSWORD are required");
}
await createRoles(url, userPassword, systemPassword);
console.log("Roles app_user and app_system are ready");
