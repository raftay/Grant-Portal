import { sql } from "drizzle-orm";
import { runDaily } from "../jobs/daily";
import { asAdmin, type Identity } from "./identity";

export async function runAlertsNow(identity: Identity) {
  await asAdmin(identity, (tx) => tx.execute(sql`select app.log_event('job.daily_requested', 'jobs')`));
  return runDaily();
}
