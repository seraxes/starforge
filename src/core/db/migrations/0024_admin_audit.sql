CREATE TABLE "sf_admin_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_admin_audit_created_at_idx" ON "sf_admin_audit" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "sf_admin_audit_actor_user_id_idx" ON "sf_admin_audit" USING btree ("actor_user_id");
