import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, escapeIdentifier, escapeLiteral } from "pg";

async function withClient<T>(url: string, work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

export async function createRoles(url: string, userPassword: string, systemPassword: string): Promise<void> {
  await withClient(url, async (client) => {
    const roles: Array<[string, string]> = [
      ["app_user", userPassword],
      ["app_system", systemPassword],
    ];
    for (const [name, password] of roles) {
      const found = await client.query("select 1 from pg_roles where rolname = $1", [name]);
      const verb = found.rowCount ? "alter" : "create";
      await client.query(`${verb} role ${escapeIdentifier(name)} login password ${escapeLiteral(password)}`);
      const attributes = await client.query(
        "select rolsuper, rolbypassrls, rolcreaterole, rolcreatedb from pg_roles where rolname = $1",
        [name],
      );
      if (Object.values(attributes.rows[0]).some(Boolean)) {
        throw new Error(`${name} has elevated attributes; recreate it with SQL rather than the hosting console`);
      }
    }
  });
}

export async function runMigrations(url: string): Promise<void> {
  await withClient(url, async (client) => {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  });
}
