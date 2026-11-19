CREATE TABLE IF NOT EXISTS "sf_sub_upgrade_paths" (
	"id" text PRIMARY KEY NOT NULL,
	"from_plan_id" text NOT NULL,
	"to_plan_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "sf_sub_upgrade_paths" ADD CONSTRAINT "sf_sub_upgrade_paths_from_plan_id_sf_sub_plans_id_fk" FOREIGN KEY ("from_plan_id") REFERENCES "public"."sf_sub_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "sf_sub_upgrade_paths" ADD CONSTRAINT "sf_sub_upgrade_paths_to_plan_id_sf_sub_plans_id_fk" FOREIGN KEY ("to_plan_id") REFERENCES "public"."sf_sub_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_sub_upgrade_paths_from_to_uidx" ON "sf_sub_upgrade_paths" USING btree ("from_plan_id","to_plan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_sub_upgrade_paths_from_idx" ON "sf_sub_upgrade_paths" USING btree ("from_plan_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_sub_upgrade_paths_to_idx" ON "sf_sub_upgrade_paths" USING btree ("to_plan_id");
--> statement-breakpoint
INSERT INTO "sf_sub_upgrade_paths" ("id", "from_plan_id", "to_plan_id")
SELECT
	'supg_' || md5(p.id || ':' || target.value),
	p.id,
	target.value
FROM "sf_sub_plans" p
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.upgrade_target_ids, '[]'::jsonb)) AS target(value)
WHERE target.value <> ''
	AND target.value <> p.id
	AND EXISTS (SELECT 1 FROM "sf_sub_plans" t WHERE t.id = target.value)
ON CONFLICT ("from_plan_id", "to_plan_id") DO NOTHING;
