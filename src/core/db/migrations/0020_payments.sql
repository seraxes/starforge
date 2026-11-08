CREATE TABLE "sf_pay_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"amount_entry_mode" text DEFAULT 'gross' NOT NULL,
	"default_vat_rate_bps" integer DEFAULT 2700 NOT NULL,
	"tax_country" text DEFAULT 'HU' NOT NULL,
	"enabled_methods" jsonb DEFAULT '["bank_transfer","pay_at_entrance","cash"]'::jsonb NOT NULL,
	"seller_name" text DEFAULT '' NOT NULL,
	"seller_address" text DEFAULT '' NOT NULL,
	"seller_vat_id" text DEFAULT '' NOT NULL,
	"bank_iban" text DEFAULT '' NOT NULL,
	"bank_name" text DEFAULT '' NOT NULL,
	"bank_account_name" text DEFAULT '' NOT NULL,
	"entrance_instructions" text DEFAULT '' NOT NULL,
	"cash_instructions" text DEFAULT '' NOT NULL,
	"invoice_series_prefix" text DEFAULT 'SF' NOT NULL,
	"checkout_ttl_minutes" integer DEFAULT 60 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_carts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"guest_token" text,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_cart_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text NOT NULL,
	"source_module" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"unit_net_minor" integer DEFAULT 0 NOT NULL,
	"unit_gross_minor" integer DEFAULT 0 NOT NULL,
	"vat_rate_bps" integer DEFAULT 2700 NOT NULL,
	"vat_category" text DEFAULT 'standard' NOT NULL,
	"vat_amount_minor" integer DEFAULT 0 NOT NULL,
	"line_net_minor" integer DEFAULT 0 NOT NULL,
	"line_gross_minor" integer DEFAULT 0 NOT NULL,
	"billing_period" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"cart_id" text,
	"user_id" text,
	"buyer_email" text DEFAULT '' NOT NULL,
	"buyer_name" text DEFAULT '' NOT NULL,
	"buyer_vat_id" text DEFAULT '' NOT NULL,
	"buyer_is_company" boolean DEFAULT false NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"tax_country" text DEFAULT 'HU' NOT NULL,
	"seller_vat_id" text DEFAULT '' NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'checkout_pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"payment_reference" text DEFAULT '' NOT NULL,
	"total_net_minor" integer DEFAULT 0 NOT NULL,
	"total_vat_minor" integer DEFAULT 0 NOT NULL,
	"total_gross_minor" integer DEFAULT 0 NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_ref" text,
	"redirect_url" text,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"mark_paid_by_user_id" text,
	"mark_paid_reason" text,
	"consumer_hook" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_order_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"source_module" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"unit_net_minor" integer DEFAULT 0 NOT NULL,
	"unit_gross_minor" integer DEFAULT 0 NOT NULL,
	"vat_rate_bps" integer DEFAULT 2700 NOT NULL,
	"vat_category" text DEFAULT 'standard' NOT NULL,
	"vat_amount_minor" integer DEFAULT 0 NOT NULL,
	"line_net_minor" integer DEFAULT 0 NOT NULL,
	"line_gross_minor" integer DEFAULT 0 NOT NULL,
	"billing_period" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_intents" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount_minor" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_invoice_sequences" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"prefix" text NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"kind" text DEFAULT 'invoice' NOT NULL,
	"issue_date" text NOT NULL,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"seller_vat_id" text DEFAULT '' NOT NULL,
	"buyer_vat_id" text DEFAULT '' NOT NULL,
	"buyer_name" text DEFAULT '' NOT NULL,
	"total_net_minor" integer DEFAULT 0 NOT NULL,
	"total_vat_minor" integer DEFAULT 0 NOT NULL,
	"total_gross_minor" integer DEFAULT 0 NOT NULL,
	"nav_sync_state" text DEFAULT 'pending' NOT NULL,
	"fiscal_ref" text,
	"credit_of_invoice_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit_net_minor" integer DEFAULT 0 NOT NULL,
	"vat_rate_bps" integer DEFAULT 2700 NOT NULL,
	"vat_category" text DEFAULT 'standard' NOT NULL,
	"line_net_minor" integer DEFAULT 0 NOT NULL,
	"line_gross_minor" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sf_pay_fiscal_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"action" text DEFAULT 'submit_invoice' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_pay_cart_lines" ADD CONSTRAINT "sf_pay_cart_lines_cart_id_sf_pay_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."sf_pay_carts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sf_pay_order_lines" ADD CONSTRAINT "sf_pay_order_lines_order_id_sf_pay_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sf_pay_orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sf_pay_intents" ADD CONSTRAINT "sf_pay_intents_order_id_sf_pay_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sf_pay_orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sf_pay_invoices" ADD CONSTRAINT "sf_pay_invoices_order_id_sf_pay_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sf_pay_orders"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sf_pay_invoice_lines" ADD CONSTRAINT "sf_pay_invoice_lines_invoice_id_sf_pay_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."sf_pay_invoices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sf_pay_fiscal_outbox" ADD CONSTRAINT "sf_pay_fiscal_outbox_invoice_id_sf_pay_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."sf_pay_invoices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sf_pay_carts_user_id_idx" ON "sf_pay_carts" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_pay_carts_guest_token_idx" ON "sf_pay_carts" USING btree ("guest_token");
--> statement-breakpoint
CREATE INDEX "sf_pay_carts_status_idx" ON "sf_pay_carts" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sf_pay_cart_lines_cart_id_idx" ON "sf_pay_cart_lines" USING btree ("cart_id");
--> statement-breakpoint
CREATE INDEX "sf_pay_cart_lines_source_idx" ON "sf_pay_cart_lines" USING btree ("source_module","source_type","source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pay_orders_idempotency_uidx" ON "sf_pay_orders" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "sf_pay_orders_status_idx" ON "sf_pay_orders" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sf_pay_orders_user_id_idx" ON "sf_pay_orders" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "sf_pay_orders_payment_reference_idx" ON "sf_pay_orders" USING btree ("payment_reference");
--> statement-breakpoint
CREATE INDEX "sf_pay_orders_provider_ref_idx" ON "sf_pay_orders" USING btree ("provider_ref");
--> statement-breakpoint
CREATE INDEX "sf_pay_order_lines_order_id_idx" ON "sf_pay_order_lines" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "sf_pay_intents_order_id_idx" ON "sf_pay_intents" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "sf_pay_intents_provider_ref_idx" ON "sf_pay_intents" USING btree ("provider_ref");
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pay_invoice_sequences_year_prefix_uidx" ON "sf_pay_invoice_sequences" USING btree ("year","prefix");
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pay_invoices_number_uidx" ON "sf_pay_invoices" USING btree ("invoice_number");
--> statement-breakpoint
CREATE INDEX "sf_pay_invoices_order_id_idx" ON "sf_pay_invoices" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "sf_pay_invoice_lines_invoice_id_idx" ON "sf_pay_invoice_lines" USING btree ("invoice_id");
--> statement-breakpoint
CREATE INDEX "sf_pay_fiscal_outbox_status_idx" ON "sf_pay_fiscal_outbox" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "sf_pay_fiscal_outbox_invoice_id_idx" ON "sf_pay_fiscal_outbox" USING btree ("invoice_id");
