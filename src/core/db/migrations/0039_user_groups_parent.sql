ALTER TABLE "sf_user_groups" ADD COLUMN IF NOT EXISTS "parent_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_user_groups_parent_id_idx" ON "sf_user_groups" USING btree ("parent_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sf_user_groups" ADD CONSTRAINT "sf_user_groups_parent_id_sf_user_groups_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sf_user_groups"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
