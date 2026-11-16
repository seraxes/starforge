CREATE TABLE "sf_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"meta_title" text DEFAULT '' NOT NULL,
	"meta_description" text DEFAULT '' NOT NULL,
	"meta_media_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pages_slug_uidx" ON "sf_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sf_pages_status_idx" ON "sf_pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sf_pages_updated_at_idx" ON "sf_pages" USING btree ("updated_at");--> statement-breakpoint
CREATE TABLE "sf_pages_tags" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pages_tags_slug_uidx" ON "sf_pages_tags" USING btree ("slug");--> statement-breakpoint
CREATE TABLE "sf_pages_page_tags" (
	"page_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "sf_pages_page_tags_page_id_sf_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."sf_pages"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "sf_pages_page_tags_tag_id_sf_pages_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."sf_pages_tags"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "sf_pages_page_tags_pk" PRIMARY KEY("page_id","tag_id")
);
--> statement-breakpoint
CREATE INDEX "sf_pages_page_tags_tag_idx" ON "sf_pages_page_tags" USING btree ("tag_id");
