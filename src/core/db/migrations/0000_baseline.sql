CREATE TABLE "sf_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_acl_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"resource" text NOT NULL,
	"allowed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_form_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"document" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_form_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"form_key" text NOT NULL,
	"definition_id" text,
	"definition_version" integer,
	"fields_snapshot" jsonb,
	"user_id" text,
	"layout_id" text,
	"slot_id" text,
	"payload" jsonb NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_forms" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT 'Untitled' NOT NULL,
	"preset" text DEFAULT 'blank' NOT NULL,
	"document" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_layouts" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT 'Untitled' NOT NULL,
	"document" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_nav_menus" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT 'Untitled' NOT NULL,
	"document" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_page_chrome" (
	"id" text PRIMARY KEY NOT NULL,
	"document" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_redirects" (
	"id" text PRIMARY KEY NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text NOT NULL,
	"status_code" integer DEFAULT 301 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "sf_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sf_site_chrome" (
	"id" text PRIMARY KEY NOT NULL,
	"document" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_two_factors" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sf_user_group_members" (
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_user_group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "sf_user_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'member' NOT NULL,
	"cms_access" boolean DEFAULT false NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sf_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sf_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_accounts" ADD CONSTRAINT "sf_accounts_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_acl_permissions" ADD CONSTRAINT "sf_acl_permissions_group_id_sf_user_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sf_user_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_sessions" ADD CONSTRAINT "sf_sessions_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_two_factors" ADD CONSTRAINT "sf_two_factors_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_user_group_members" ADD CONSTRAINT "sf_user_group_members_group_id_sf_user_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sf_user_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sf_user_group_members" ADD CONSTRAINT "sf_user_group_members_user_id_sf_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sf_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sf_accounts_user_id_idx" ON "sf_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_acl_permissions_group_resource_uidx" ON "sf_acl_permissions" USING btree ("group_id","resource");--> statement-breakpoint
CREATE INDEX "sf_acl_permissions_group_id_idx" ON "sf_acl_permissions" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "sf_form_submissions_form_key_idx" ON "sf_form_submissions" USING btree ("form_key");--> statement-breakpoint
CREATE INDEX "sf_form_submissions_definition_id_idx" ON "sf_form_submissions" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "sf_form_submissions_created_at_idx" ON "sf_form_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sf_form_submissions_user_id_idx" ON "sf_form_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sf_redirects_from_path_uidx" ON "sf_redirects" USING btree ("from_path");--> statement-breakpoint
CREATE INDEX "sf_redirects_enabled_idx" ON "sf_redirects" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "sf_sessions_user_id_idx" ON "sf_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_two_factors_user_id_idx" ON "sf_two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_two_factors_secret_idx" ON "sf_two_factors" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "sf_user_group_members_user_id_idx" ON "sf_user_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sf_verifications_identifier_idx" ON "sf_verifications" USING btree ("identifier");