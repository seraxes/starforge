CREATE TABLE "sf_event_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"submission_id" text,
	"user_id" text,
	"name" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"guests" integer DEFAULT 1 NOT NULL,
	"attendance" text DEFAULT 'in_person' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_event_registrations" ADD CONSTRAINT "sf_event_registrations_event_id_sf_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."sf_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_event_registrations_event_id_idx" ON "sf_event_registrations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "sf_event_registrations_email_idx" ON "sf_event_registrations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "sf_event_registrations_status_idx" ON "sf_event_registrations" USING btree ("status");
