import { Pool, type PoolClient, type QueryResult } from "pg";
import { ownerUrl, systemUrl, userUrl } from "./config";

const pools = { owner: new Pool({ connectionString: ownerUrl }), user: new Pool({ connectionString: userUrl }), system: new Pool({ connectionString: systemUrl }) };

export async function session<T>(
  kind: keyof typeof pools,
  userId: string | null,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pools[kind].connect();
  try {
    await client.query("begin");
    if (userId) await client.query("select set_config('app.user_id', $1, true)", [userId]);
    return await work(client);
  } finally {
    await client.query("rollback");
    client.release();
  }
}

export const asUser = <T>(userId: string | null, work: (c: PoolClient) => Promise<T>) => session("user", userId, work);
export const asSystem = <T>(work: (c: PoolClient) => Promise<T>) => session("system", null, work);
export const asOwner = <T>(work: (c: PoolClient) => Promise<T>) => session("owner", null, work);

export async function allowed(client: PoolClient, statement: string): Promise<boolean> {
  await client.query("savepoint attempt");
  try {
    const result: QueryResult = await client.query(statement);
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    if ((error as { code?: string }).code === "42501") return false;
    throw new Error(`${(error as Error).message} in: ${statement}`);
  } finally {
    await client.query("rollback to savepoint attempt");
  }
}

export async function closePools(): Promise<void> {
  await Promise.all(Object.values(pools).map((pool) => pool.end()));
}
