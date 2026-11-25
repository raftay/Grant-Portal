import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { id, moment, timestamps, tokenPurpose, userRole, userStatus } from "./common";

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: moment("email_verified"),
    image: text("image"),
    role: userRole("role").notNull().default("viewer"),
    status: userStatus("status").notNull().default("invited"),
    canViewPayroll: boolean("can_view_payroll").notNull().default(false),
    sessionVersion: integer("session_version").notNull().default(1),
    invitedBy: uuid("invited_by").references((): AnyPgColumn => users.id),
    ...timestamps(),
  },
  (t) => [uniqueIndex("users_email_lower_key").on(sql`lower(${t.email})`)],
);

export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  passwordHash: text("password_hash").notNull(),
  updatedAt: moment("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: moment("expires").notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    purpose: tokenPurpose("purpose").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: moment("expires_at").notNull(),
    usedAt: moment("used_at"),
    createdAt: moment("created_at").notNull().defaultNow(),
  },
  (t) => [index("auth_tokens_user_idx").on(t.userId)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    emailHash: text("email_hash").notNull(),
    ipHash: text("ip_hash").notNull(),
    succeeded: boolean("succeeded").notNull(),
    attemptedAt: moment("attempted_at").notNull().defaultNow(),
  },
  (t) => [
    index("login_attempts_email_idx").on(t.emailHash, t.attemptedAt),
    index("login_attempts_ip_idx").on(t.ipHash, t.attemptedAt),
  ],
);
