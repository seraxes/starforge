CREATE TABLE "sf_documents_links" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"template_id" text DEFAULT '' NOT NULL,
	"media_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_documents_links_subject_template_uidx" ON "sf_documents_links" USING btree ("subject_kind","subject_id","template_id") WHERE "sf_documents_links"."template_id" <> '';
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_documents_links_subject_media_uidx" ON "sf_documents_links" USING btree ("subject_kind","subject_id","media_id") WHERE "sf_documents_links"."template_id" = '';
--> statement-breakpoint
CREATE INDEX "sf_documents_links_subject_idx" ON "sf_documents_links" USING btree ("subject_kind","subject_id");
--> statement-breakpoint
CREATE INDEX "sf_documents_links_media_idx" ON "sf_documents_links" USING btree ("media_id");
