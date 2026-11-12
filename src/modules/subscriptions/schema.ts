/**
 * product:subscriptions tables (sf_sub_*).
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
} from 'drizzle-orm/pg-core'

/** Plan catalog — membership / organizer / advertisement (+ open subject). */
export const sfSubPlans = pgTable(
  'sf_sub_plans',
  {
    id: text('id').primaryKey(),
    /** membership | organizer | advertisement | open string */
    subject: text('subject').notNull().default('membership'),
    /** For advertisement: shop | organizer | marketplace | open string */
    audience: text('audience').notNull().default(''),
    title: text('title').notNull().default('Plan'),
    description: text('description').notNull().default(''),
    /** Major units (site currency). */
    price: integer('price').notNull().default(0),
    /** month | year */
    billingPeriod: text('billing_period').notNull().default('month'),
    /** Entitlement keys granted while active. */
    entitlementKeys: jsonb('entitlement_keys').$type<string[]>().notNull().default([]),
    /** Optional Core user-group ids (audience resolve only — not written to membership). */
    groupIds: jsonb('group_ids').$type<string[]>().notNull().default([]),
    sourceModule: text('source_module').notNull().default(''),
    sourceType: text('source_type').notNull().default(''),
    sourceId: text('source_id').notNull().default(''),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_sub_plans_subject_idx').on(table.subject),
    index('sf_sub_plans_active_idx').on(table.active),
    index('sf_sub_plans_sort_idx').on(table.sortOrder),
  ],
)

/** One purchase / admin-comp window. */
export const sfSubPeriods = pgTable(
  'sf_sub_periods',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => sfSubPlans.id, { onDelete: 'restrict' }),
    userId: text('user_id').notNull(),
    /** active | expired | refunded */
    status: text('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    orderId: text('order_id'),
    /** Snapshot at activate — plan edits do not rewrite. */
    subject: text('subject').notNull().default('membership'),
    audience: text('audience').notNull().default(''),
    billingPeriod: text('billing_period').notNull().default('month'),
    entitlementKeys: jsonb('entitlement_keys').$type<string[]>().notNull().default([]),
    groupIds: jsonb('group_ids').$type<string[]>().notNull().default([]),
    sourceModule: text('source_module').notNull().default(''),
    sourceType: text('source_type').notNull().default(''),
    sourceId: text('source_id').notNull().default(''),
    /** purchase | admin_comp */
    source: text('source').notNull().default('purchase'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_sub_periods_user_id_idx').on(table.userId),
    index('sf_sub_periods_plan_id_idx').on(table.planId),
    index('sf_sub_periods_status_idx').on(table.status),
    index('sf_sub_periods_ends_at_idx').on(table.endsAt),
    index('sf_sub_periods_order_id_idx').on(table.orderId),
    index('sf_sub_periods_user_status_idx').on(table.userId, table.status),
  ],
)
