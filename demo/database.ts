import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";
import { loadSeed } from "../seed/load";
import type { Person } from "../seed/data";
import { hashPassword } from "./shims/password";

const migrations = import.meta.glob<string>("../drizzle/*.sql", { query: "?raw", import: "default", eager: true });
const address = "idb://grant-portal-demo";
const stored = "/pglite/grant-portal-demo";
const resetKey = "grant-portal-demo-reset";

export const credentials: Record<Person, string> = {
  alex: "Harbor-Admin-2026",
  jamie: "Harbor-Staff-2026",
  sam: "Harbor-Staff2-2026",
  taylor: "Harbor-View-2026",
};

export type DemoDatabase = PgliteDatabase<typeof schema>;

async function digest(bytes: Uint8Array): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>));
  return [...hash].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function build(client: PGlite): Promise<void> {
  await client.transaction(async (tx) => {
    await tx.exec("create role app_user nologin; create role app_system nologin;");
    for (const name of Object.keys(migrations).sort()) await tx.exec(migrations[name]!);
    await tx.exec("create schema demo; create table demo.objects (key text primary key, bytes bytea not null, mime_type text not null);");
    await loadSeed({
      query: async (text, values) => (await tx.query<{ id: string }>(text, values)).rows,
      store: async (key, bytes) => {
        await tx.query("insert into demo.objects (key, bytes, mime_type) values ($1, $2, 'application/pdf')", [key, bytes]);
      },
      hashPassword,
      sha256: digest,
      passwordFor: (person) => credentials[person],
    });
  });
}

function erase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(stored);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error("The demo database could not be deleted"));
    request.onblocked = () => reject(new Error("Close other tabs showing this demo, then reload"));
  });
}

let opened: Promise<{ client: PGlite; db: DemoDatabase }> | undefined;

export function open(): Promise<{ client: PGlite; db: DemoDatabase }> {
  opened ??= (async () => {
    if (localStorage.getItem(resetKey)) {
      await erase();
      localStorage.removeItem(resetKey);
    }
    const client = await PGlite.create(address);
    const ready = await client.query<{ present: boolean }>("select to_regclass('demo.objects') is not null as present");
    if (!ready.rows[0]?.present) await build(client);
    return { client, db: drizzle(client, { schema }) };
  })();
  return opened;
}

export function reset(): void {
  localStorage.setItem(resetKey, "1");
  sessionStorage.clear();
  location.reload();
}

export async function runAs(email: string, statement: string): Promise<string> {
  const { client } = await open();
  return client.transaction(async (tx) => {
    const [person] = (await tx.query<{ id: string }>("select id from users where email = $1", [email])).rows;
    await tx.exec("set local role app_user");
    await tx.query("select set_config('app.user_id', $1, true)", [person ? person.id : ""]);
    try {
      const result = await tx.query(statement);
      const count = result.affectedRows ? result.affectedRows : result.rows.length;
      return `${count} rows`;
    } catch (error) {
      if ((error as { code?: string }).code === "42501") return "refused";
      throw error;
    } finally {
      await tx.rollback();
    }
  });
}
