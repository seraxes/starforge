CREATE TABLE "sf_pay_merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"seller_name" text DEFAULT '' NOT NULL,
	"seller_address" text DEFAULT '' NOT NULL,
	"seller_vat_id" text DEFAULT '' NOT NULL,
	"bank_iban" text DEFAULT '' NOT NULL,
	"bank_name" text DEFAULT '' NOT NULL,
	"bank_account_name" text DEFAULT '' NOT NULL,
	"entrance_instructions" text DEFAULT '' NOT NULL,
	"cash_instructions" text DEFAULT '' NOT NULL,
	"billing_provider" text DEFAULT 'noop' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_merchant_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"kind" text NOT NULL,
	"secret_cipher" text DEFAULT '' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_collect_entitlements" (
	"user_id" text PRIMARY KEY NOT NULL,
	"can_collect_payments" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'stub' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_pay_orders" ADD COLUMN "merchant_id" text;
--> statement-breakpoint
ALTER TABLE "sf_pay_orders" ADD COLUMN "platform_fee_minor" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sf_pay_invoices" ADD COLUMN "billing_provider" text;
--> statement-breakpoint
ALTER TABLE "sf_pay_invoices" ADD COLUMN "billing_external_id" text;
--> statement-breakpoint
ALTER TABLE "sf_pay_merchant_credentials" ADD CONSTRAINT "sf_pay_merchant_credentials_merchant_id_sf_pay_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."sf_pay_merchants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sf_pay_orders" ADD CONSTRAINT "sf_pay_orders_merchant_id_sf_pay_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."sf_pay_merchants"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pay_merchants_user_id_uidx" ON "sf_pay_merchants" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_pay_merchants_status_idx" ON "sf_pay_merchants" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pay_merchant_credentials_merchant_kind_uidx" ON "sf_pay_merchant_credentials" USING btree ("merchant_id","kind");
--> statement-breakpoint
CREATE INDEX "sf_pay_orders_merchant_id_idx" ON "sf_pay_orders" USING btree ("merchant_id");
