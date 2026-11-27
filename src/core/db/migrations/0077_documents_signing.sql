ALTER TABLE "sf_documents_links" ADD COLUMN IF NOT EXISTS "status" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_documents_links" ADD COLUMN IF NOT EXISTS "provider_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_documents_links" ADD COLUMN IF NOT EXISTS "envelope_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "sf_documents_links" ADD COLUMN IF NOT EXISTS "generation" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "sf_documents_links_subject_template_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_documents_links_subject_template_gen_uidx" ON "sf_documents_links" USING btree ("subject_kind","subject_id","template_id","generation") WHERE "sf_documents_links"."template_id" <> '';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_documents_links_envelope_idx" ON "sf_documents_links" USING btree ("provider_id","envelope_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sf_documents_signature_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"envelope_id" text DEFAULT '' NOT NULL,
	"link_id" text DEFAULT '' NOT NULL,
	"status" text DEFAULT '' NOT NULL,
	"media_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sf_documents_signature_receipts_event_uidx" ON "sf_documents_signature_receipts" USING btree ("provider_id","provider_event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sf_documents_signature_receipts_envelope_idx" ON "sf_documents_signature_receipts" USING btree ("provider_id","envelope_id");
