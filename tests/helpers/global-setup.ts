import { Client } from "pg";
import { createRoles, runMigrations } from "../../scripts/lib/database";
import { adminUrl, ownerUrl, testDatabase } from "./config";
import { loadFixtures } from "./fixtures";

export default async function setup(): Promise<void> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${testDatabase} with (force)`);
  await admin.query(`create database ${testDatabase}`);
  await admin.end();
  await createRoles(adminUrl, "app_user", "app_system");
  await runMigrations(ownerUrl);
  const owner = new Client({ connectionString: ownerUrl });
  await owner.connect();
  await loadFixtures(owner);
  await owner.end();
}
