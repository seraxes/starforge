CREATE TABLE "sf_social_post_hides" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_social_post_hides_user_post_uidx" ON "sf_social_post_hides" USING btree ("user_id","post_id");
--> statement-breakpoint
CREATE INDEX "sf_social_post_hides_user_idx" ON "sf_social_post_hides" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_social_post_hides_post_idx" ON "sf_social_post_hides" USING btree ("post_id");
--> statement-breakpoint
CREATE TABLE "sf_social_mutes" (
	"id" text PRIMARY KEY NOT NULL,
	"muter_user_id" text NOT NULL,
	"muted_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_social_mutes_pair_uidx" ON "sf_social_mutes" USING btree ("muter_user_id","muted_user_id");
--> statement-breakpoint
CREATE INDEX "sf_social_mutes_muter_idx" ON "sf_social_mutes" USING btree ("muter_user_id");
--> statement-breakpoint
CREATE INDEX "sf_social_mutes_muted_idx" ON "sf_social_mutes" USING btree ("muted_user_id");
