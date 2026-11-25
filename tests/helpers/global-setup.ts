import { Client } from "pg";
import { createRoles, runMigrations } from "../../scripts/lib/database";
import { adminUrl, templateDatabase, testDatabase, urlFor } from "./config";
import { loadFixtures } from "./fixtures";

export default async function setup(): Promise<void> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  for (const name of [testDatabase, templateDatabase]) await admin.query(`drop database if exists ${name} with (force)`);
  await admin.query(`create database ${templateDatabase}`);
  await createRoles(adminUrl, "app_user", "app_system");
  const templateUrl = urlFor(null, null, templateDatabase);
  await runMigrations(templateUrl);
  const owner = new Client({ connectionString: templateUrl });
  await owner.connect();
  await loadFixtures(owner);
  await owner.end();
  await admin.query(`create database ${testDatabase} template ${templateDatabase}`);
  await admin.end();
}
