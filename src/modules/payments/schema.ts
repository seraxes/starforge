/**
 * product:payments tables (sf_pay_*).
 * Included via drizzle.config schema glob under src/modules.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Site-wide commerce settings (single row id = `default`). */
export const sfPaySettings = pgTable('sf_pay_settings', {
  id: text('id').primaryKey().default('default'),
  currency: text('currency').notNull().default('HUF'),
  /** gross | net — admin price entry mode. */
  amountEntryMode: text('amount_entry_mode').notNull().default('gross'),
  defaultVatRateBps: integer('default_vat_rate_bps').notNull().default(2700),
  taxCountry: text('tax_country').notNull().default('HU'),
  enabledMethods: jsonb('enabled_methods')
    .$type<string[]>()
    .notNull()
    .default(['bank_transfer', 'pay_at_entrance', 'cash']),
  sellerName: text('seller_name').notNull().default(''),
  sellerAddress: text('seller_address').notNull().default(''),
  sellerVatId: text('seller_vat_id').notNull().default(''),
  bankIban: text('bank_iban').notNull().default(''),
  bankName: text('bank_name').notNull().default(''),
  bankAccountName: text('bank_account_name').notNull().default(''),
  entranceInstructions: text('entrance_instructions').notNull().default(''),
  cashInstructions: text('cash_instructions').notNull().default(''),
  invoiceSeriesPrefix: text('invoice_series_prefix').notNull().default('SF'),
  checkoutTtlMinutes: integer('checkout_ttl_minutes').notNull().default(60),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const sfPayCarts = pgTable(
  'sf_pay_carts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    guestToken: text('guest_token'),
    currency: text('currency').notNull().default('HUF'),
    status: text('status').notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_pay_carts_user_id_idx').on(table.userId),
    index('sf_pay_carts_guest_token_idx').on(table.guestToken),
    index('sf_pay_carts_status_idx').on(table.status),
  ],
)

export const sfPayCartLines = pgTable(
  'sf_pay_cart_lines',
  {
    id: text('id').primaryKey(),
    cartId: text('cart_id')
      .notNull()
      .references(() => sfPayCarts.id, { onDelete: 'cascade' }),
    sourceModule: text('source_module').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull().default(''),
    qty: integer('qty').notNull().default(1),
    currency: text('currency').notNull().default('HUF'),
    unitNetMinor: integer('unit_net_minor').notNull().default(0),
    unitGrossMinor: integer('unit_gross_minor').notNull().default(0),
    vatRateBps: integer('vat_rate_bps').notNull().default(2700),
    vatCategory: text('vat_category').notNull().default('standard'),
    vatAmountMinor: integer('vat_amount_minor').notNull().default(0),
    lineNetMinor: integer('line_net_minor').notNull().default(0),
    lineGrossMinor: integer('line_gross_minor').notNull().default(0),
    /** month | year | null for one-shot */
    billingPeriod: text('billing_period'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_pay_cart_lines_cart_id_idx').on(table.cartId),
    index('sf_pay_cart_lines_source_idx').on(table.sourceModule, table.sourceType, table.sourceId),
  ],
)

/** Premium merchant (organizer/vendor) — own keys, own invoices. */
export const sfPayMerchants = pgTable(
  'sf_pay_merchants',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    displayName: text('display_name').notNull().default(''),
    status: text('status').notNull().default('draft'),
    sellerName: text('seller_name').notNull().default(''),
    sellerAddress: text('seller_address').notNull().default(''),
    sellerVatId: text('seller_vat_id').notNull().default(''),
    bankIban: text('bank_iban').notNull().default(''),
    bankName: text('bank_name').notNull().default(''),
    bankAccountName: text('bank_account_name').notNull().default(''),
    entranceInstructions: text('entrance_instructions').notNull().default(''),
    cashInstructions: text('cash_instructions').notNull().default(''),
    /** billingo | szamlazz | noop */
    billingProvider: text('billing_provider').notNull().default('noop'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_pay_merchants_user_id_uidx').on(table.userId),
    index('sf_pay_merchants_status_idx').on(table.status),
  ],
)

export const sfPayMerchantCredentials = pgTable(
  'sf_pay_merchant_credentials',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => sfPayMerchants.id, { onDelete: 'cascade' }),
    /** barion | stripe | paypal | billingo | szamlazz */
    kind: text('kind').notNull(),
    /** AES-GCM ciphertext (base64) — never log. */
    secretCipher: text('secret_cipher').notNull().default(''),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_pay_merchant_credentials_merchant_kind_uidx').on(
      table.merchantId,
      table.kind,
    ),
  ],
)

/** Site-wide stub until product:subscriptions ships — user ids with canCollectPayments. */
export const sfPayCollectEntitlements = pgTable(
  'sf_pay_collect_entitlements',
  {
    userId: text('user_id').primaryKey(),
    canCollectPayments: boolean('can_collect_payments').notNull().default(true),
    source: text('source').notNull().default('stub'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
)

export const sfPayOrders = pgTable(
  'sf_pay_orders',
  {
    id: text('id').primaryKey(),
    cartId: text('cart_id'),
    userId: text('user_id'),
    /** Null = site MoR; set = premium merchant checkout. */
    merchantId: text('merchant_id').references(() => sfPayMerchants.id, {
      onDelete: 'set null',
    }),
    buyerEmail: text('buyer_email').notNull().default(''),
    buyerName: text('buyer_name').notNull().default(''),
    buyerVatId: text('buyer_vat_id').notNull().default(''),
    buyerIsCompany: boolean('buyer_is_company').notNull().default(false),
    currency: text('currency').notNull().default('HUF'),
    taxCountry: text('tax_country').notNull().default('HU'),
    sellerVatId: text('seller_vat_id').notNull().default(''),
    method: text('method').notNull(),
    status: text('status').notNull().default('checkout_pending'),
    idempotencyKey: text('idempotency_key').notNull(),
    paymentReference: text('payment_reference').notNull().default(''),
    totalNetMinor: integer('total_net_minor').notNull().default(0),
    totalVatMinor: integer('total_vat_minor').notNull().default(0),
    totalGrossMinor: integer('total_gross_minor').notNull().default(0),
    platformFeeMinor: integer('platform_fee_minor').notNull().default(0),
    provider: text('provider').notNull().default('manual'),
    providerRef: text('provider_ref'),
    redirectUrl: text('redirect_url'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    markPaidByUserId: text('mark_paid_by_user_id'),
    markPaidReason: text('mark_paid_reason'),
    consumerHook: text('consumer_hook'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_pay_orders_idempotency_uidx').on(table.idempotencyKey),
    index('sf_pay_orders_status_idx').on(table.status),
    index('sf_pay_orders_user_id_idx').on(table.userId),
    index('sf_pay_orders_merchant_id_idx').on(table.merchantId),
    index('sf_pay_orders_payment_reference_idx').on(table.paymentReference),
    index('sf_pay_orders_provider_ref_idx').on(table.providerRef),
  ],
)

export const sfPayOrderLines = pgTable(
  'sf_pay_order_lines',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => sfPayOrders.id, { onDelete: 'cascade' }),
    sourceModule: text('source_module').notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull().default(''),
    qty: integer('qty').notNull().default(1),
    currency: text('currency').notNull().default('HUF'),
    unitNetMinor: integer('unit_net_minor').notNull().default(0),
    unitGrossMinor: integer('unit_gross_minor').notNull().default(0),
    vatRateBps: integer('vat_rate_bps').notNull().default(2700),
    vatCategory: text('vat_category').notNull().default('standard'),
    vatAmountMinor: integer('vat_amount_minor').notNull().default(0),
    lineNetMinor: integer('line_net_minor').notNull().default(0),
    lineGrossMinor: integer('line_gross_minor').notNull().default(0),
    billingPeriod: text('billing_period'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  },
  (table) => [index('sf_pay_order_lines_order_id_idx').on(table.orderId)],
)

export const sfPayIntents = pgTable(
  'sf_pay_intents',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => sfPayOrders.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerRef: text('provider_ref'),
    status: text('status').notNull().default('pending'),
    amountMinor: integer('amount_minor').notNull().default(0),
    currency: text('currency').notNull().default('HUF'),
    raw: jsonb('raw').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_pay_intents_order_id_idx').on(table.orderId),
    index('sf_pay_intents_provider_ref_idx').on(table.providerRef),
  ],
)

export const sfPayInvoices = pgTable(
  'sf_pay_invoices',
  {
    id: text('id').primaryKey(),
    orderId: text('order_id')
      .notNull()
      .references(() => sfPayOrders.id, { onDelete: 'restrict' }),
    invoiceNumber: text('invoice_number').notNull(),
    kind: text('kind').notNull().default('invoice'),
    issueDate: text('issue_date').notNull(),
    currency: text('currency').notNull().default('HUF'),
    sellerVatId: text('seller_vat_id').notNull().default(''),
    buyerVatId: text('buyer_vat_id').notNull().default(''),
    buyerName: text('buyer_name').notNull().default(''),
    totalNetMinor: integer('total_net_minor').notNull().default(0),
    totalVatMinor: integer('total_vat_minor').notNull().default(0),
    totalGrossMinor: integer('total_gross_minor').notNull().default(0),
    navSyncState: text('nav_sync_state').notNull().default('pending'),
    fiscalRef: text('fiscal_ref'),
    /** billingo | szamlazz | noop | null */
    billingProvider: text('billing_provider'),
    billingExternalId: text('billing_external_id'),
    creditOfInvoiceId: text('credit_of_invoice_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sf_pay_invoices_number_uidx').on(table.invoiceNumber),
    index('sf_pay_invoices_order_id_idx').on(table.orderId),
  ],
)

export const sfPayInvoiceLines = pgTable(
  'sf_pay_invoice_lines',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => sfPayInvoices.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default(''),
    qty: integer('qty').notNull().default(1),
    unitNetMinor: integer('unit_net_minor').notNull().default(0),
    vatRateBps: integer('vat_rate_bps').notNull().default(2700),
    vatCategory: text('vat_category').notNull().default('standard'),
    lineNetMinor: integer('line_net_minor').notNull().default(0),
    lineGrossMinor: integer('line_gross_minor').notNull().default(0),
  },
  (table) => [index('sf_pay_invoice_lines_invoice_id_idx').on(table.invoiceId)],
)

export const sfPayFiscalOutbox = pgTable(
  'sf_pay_fiscal_outbox',
  {
    id: text('id').primaryKey(),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => sfPayInvoices.id, { onDelete: 'cascade' }),
    action: text('action').notNull().default('submit_invoice'),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_pay_fiscal_outbox_status_idx').on(table.status),
    index('sf_pay_fiscal_outbox_invoice_id_idx').on(table.invoiceId),
  ],
)

/** Gapless invoice sequence per year. */
export const sfPayInvoiceSequences = pgTable(
  'sf_pay_invoice_sequences',
  {
    id: text('id').primaryKey(),
    year: integer('year').notNull(),
    prefix: text('prefix').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
  },
  (table) => [uniqueIndex('sf_pay_invoice_sequences_year_prefix_uidx').on(table.year, table.prefix)],
)

/**
 * Shared checkout coupons (site-wide or scoped to sourceModule + sourceId).
 * Amount / percent one-field rule: `500` vs `10%`. Not Events-local.
 */
export const sfPayCoupons = pgTable(
  'sf_pay_coupons',
  {
    id: text('id').primaryKey(),
    /** Normalized uppercase code. */
    code: text('code').notNull(),
    /** Major units (amount) or percent points (10 = 10% off). Always a discount. */
    discountValue: integer('discount_value').notNull().default(0),
    /** `amount` | `percent` */
    discountMode: text('discount_mode').notNull().default('amount'),
    /** Null = unlimited. */
    usageLimit: integer('usage_limit'),
    usedCount: integer('used_count').notNull().default(0),
    /** Null + null sourceId = site-wide. Event-scoped = product:events + event id. */
    sourceModule: text('source_module'),
    sourceId: text('source_id'),
    currency: text('currency').notNull().default('HUF'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_pay_coupons_code_uidx').on(table.code),
    index('sf_pay_coupons_active_idx').on(table.active),
    index('sf_pay_coupons_source_idx').on(table.sourceModule, table.sourceId),
  ],
)

export const sfPayCouponRedemptions = pgTable(
  'sf_pay_coupon_redemptions',
  {
    id: text('id').primaryKey(),
    couponId: text('coupon_id')
      .notNull()
      .references(() => sfPayCoupons.id, { onDelete: 'cascade' }),
    orderId: text('order_id')
      .notNull()
      .references(() => sfPayOrders.id, { onDelete: 'cascade' }),
    discountMinor: integer('discount_minor').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sf_pay_coupon_redemptions_order_uidx').on(table.orderId),
    index('sf_pay_coupon_redemptions_coupon_id_idx').on(table.couponId),
  ],
)

/**
 * Gateway recurring intents (auto-renew). Secrets stay in env / merchant credentials.
 * Consumers (Subscriptions) store the id and grant on each paid charge hook.
 */
export const sfPayRecurring = pgTable(
  'sf_pay_recurring',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    method: text('method').notNull().default(''),
    /** active | canceled */
    status: text('status').notNull().default('active'),
    providerRef: text('provider_ref').notNull().default(''),
    sourceModule: text('source_module').notNull().default(''),
    sourceType: text('source_type').notNull().default(''),
    sourceId: text('source_id').notNull().default(''),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    nextChargeAt: timestamp('next_charge_at', { withTimezone: true }),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_pay_recurring_user_id_idx').on(table.userId),
    index('sf_pay_recurring_status_idx').on(table.status),
    index('sf_pay_recurring_source_idx').on(
      table.sourceModule,
      table.sourceType,
      table.sourceId,
    ),
  ],
)
