CREATE TABLE "sf_media_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"document" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_module_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"document" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
