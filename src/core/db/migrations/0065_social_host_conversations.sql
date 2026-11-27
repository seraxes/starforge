CREATE TABLE "sf_social_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"host_module" text NOT NULL,
	"host_id" text NOT NULL,
	"post_id" text NOT NULL,
	"host_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_social_conversations_host_uidx" ON "sf_social_conversations" USING btree ("host_module","host_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_social_conversations_post_uidx" ON "sf_social_conversations" USING btree ("post_id");
--> statement-breakpoint
CREATE INDEX "sf_social_conversations_created_idx" ON "sf_social_conversations" USING btree ("created_at");
