CREATE TABLE "sf_email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT 'Untitled template' NOT NULL,
	"module_category" text DEFAULT 'other' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"body_text" text DEFAULT '' NOT NULL,
	"body_html" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_email_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT 'Untitled rule' NOT NULL,
	"module_category" text DEFAULT 'other' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"trigger_key" text NOT NULL,
	"mode" text DEFAULT 'automatic' NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"audience" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"template_id" text NOT NULL,
	"from_override" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_email_rules" ADD CONSTRAINT "sf_email_rules_template_id_sf_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."sf_email_templates"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sf_email_templates_module_category_idx" ON "sf_email_templates" USING btree ("module_category");
--> statement-breakpoint
CREATE INDEX "sf_email_rules_module_category_idx" ON "sf_email_rules" USING btree ("module_category");
--> statement-breakpoint
CREATE INDEX "sf_email_rules_trigger_key_idx" ON "sf_email_rules" USING btree ("trigger_key");
--> statement-breakpoint
CREATE INDEX "sf_email_rules_enabled_idx" ON "sf_email_rules" USING btree ("enabled");
--> statement-breakpoint
CREATE INDEX "sf_email_rules_template_id_idx" ON "sf_email_rules" USING btree ("template_id");
