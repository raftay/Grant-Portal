ALTER TABLE "notifications" DROP CONSTRAINT "notifications_milestone";
ALTER TABLE "deadlines" ADD COLUMN "reminder_days" integer DEFAULT 7 NOT NULL;
ALTER TABLE "grants" ADD COLUMN "purpose" text;
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_reminder" CHECK ("deadlines"."reminder_days" between 1 and 90);
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_milestone" CHECK ("notifications"."milestone" in ('30d', 'reminder', 'overdue'));