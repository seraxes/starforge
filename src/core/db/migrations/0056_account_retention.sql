ALTER TABLE "sf_users" ADD COLUMN IF NOT EXISTS "hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sf_users" ADD COLUMN IF NOT EXISTS "purge_eligible_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sf_users" ADD COLUMN IF NOT EXISTS "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_users_hidden_at_idx" ON "sf_users" USING btree ("hidden_at");--> statement-breakpoint
ALTER TABLE "sf_site_settings" ADD COLUMN IF NOT EXISTS "account_retention_days" integer DEFAULT 365 NOT NULL;
