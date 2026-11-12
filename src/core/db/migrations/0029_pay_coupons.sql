CREATE TABLE "sf_pay_coupons" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"discount_value" integer DEFAULT 0 NOT NULL,
	"discount_mode" text DEFAULT 'amount' NOT NULL,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"source_module" text,
	"source_id" text,
	"currency" text DEFAULT 'HUF' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pay_coupons_code_uidx" ON "sf_pay_coupons" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "sf_pay_coupons_active_idx" ON "sf_pay_coupons" USING btree ("active");
--> statement-breakpoint
CREATE INDEX "sf_pay_coupons_source_idx" ON "sf_pay_coupons" USING btree ("source_module", "source_id");
--> statement-breakpoint
CREATE TABLE "sf_pay_coupon_redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"coupon_id" text NOT NULL,
	"order_id" text NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sf_pay_coupon_redemptions" ADD CONSTRAINT "sf_pay_coupon_redemptions_coupon_id_sf_pay_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."sf_pay_coupons"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sf_pay_coupon_redemptions" ADD CONSTRAINT "sf_pay_coupon_redemptions_order_id_sf_pay_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sf_pay_orders"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "sf_pay_coupon_redemptions_order_uidx" ON "sf_pay_coupon_redemptions" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX "sf_pay_coupon_redemptions_coupon_id_idx" ON "sf_pay_coupon_redemptions" USING btree ("coupon_id");
