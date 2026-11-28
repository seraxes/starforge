CREATE TABLE "sf_documents_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"subject_kind" text NOT NULL,
	"render_source" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sf_documents_templates_subject_idx" ON "sf_documents_templates" USING btree ("subject_kind");
--> statement-breakpoint
CREATE INDEX "sf_documents_templates_enabled_idx" ON "sf_documents_templates" USING btree ("enabled");
