ALTER TABLE "sf_pages" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sf_pages" ADD COLUMN "created_by_user_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_pages" ADD COLUMN "published_by_user_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "sf_pages_published_at_idx" ON "sf_pages" USING btree ("published_at");--> statement-breakpoint
UPDATE "sf_pages" SET "published_at" = "updated_at" WHERE "status" = 'published' AND "published_at" IS NULL;
