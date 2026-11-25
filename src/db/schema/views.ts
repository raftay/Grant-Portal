import { bigint, pgView, text, uuid } from "drizzle-orm/pg-core";
import { moment } from "./common";

export const recentActivity = pgView("recent_activity", {
  id: bigint("id", { mode: "number" }).notNull(),
  occurredAt: moment("occurred_at").notNull(),
  actorId: uuid("actor_id"),
  actorName: text("actor_name"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  grantId: uuid("grant_id"),
  label: text("label"),
}).existing();
