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
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Plan catalog — membership / organizer / advertisement / other (+ open subject). */
export const sfSubPlans = pgTable(
  'sf_sub_plans',
  {
    id: text('id').primaryKey(),
    /** membership | organizer | advertisement | other | open string */
    subject: text('subject').notNull().default('membership'),
    /**
     * Subtype within the subject.
     * membership: premium | premium_plus (empty reads as premium)
     * organizer: organizer | brand (empty reads as organizer; brand = managed page)
     * advertisement: organizer | marketplace | brand | shop
     */
    audience: text('audience').notNull().default(''),
    title: text('title').notNull().default('Plan'),
    description: text('description').notNull().default(''),
    /** Major units (site currency). 0 = free plan. */
    price: integer('price').notNull().default(0),
    /** day | week | month | year | lifetime */
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
    trialDurationDays: integer('trial_duration_days').notNull().default(0),
    trialPrice: integer('trial_price').notNull().default(0),
    trialOnce: boolean('trial_once').notNull().default(true),
    lifetime: boolean('lifetime').notNull().default(false),
    fixedExpiresAt: timestamp('fixed_expires_at', { withTimezone: true }),
    /** 0 = unlimited active periods for this plan. */
    maxActive: integer('max_active').notNull().default(0),
    /** Optional product:forms definition id. */
    formDefinitionId: text('form_definition_id').notNull().default(''),
    /** Days before endsAt when early renew price applies. 0 = always use early price when set. */
    earlyRenewDays: integer('early_renew_days').notNull().default(0),
    /** Major units; null = use normal price. */
    earlyRenewPrice: integer('early_renew_price'),
    upgradeTargetIds: jsonb('upgrade_target_ids').$type<string[]>().notNull().default([]),
    graceHours: integer('grace_hours').notNull().default(0),
    /** 0 = no seat pool (single subscriber). */
    seatLimit: integer('seat_limit').notNull().default(0),
    recurringSupported: boolean('recurring_supported').notNull().default(false),
    imageMediaId: text('image_media_id').notNull().default(''),
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
    /** purchase | admin_comp | free | trial | upgrade */
    source: text('source').notNull().default('purchase'),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    autoRenew: boolean('auto_renew').notNull().default(false),
    paymentsRecurringId: text('payments_recurring_id'),
    isTrial: boolean('is_trial').notNull().default(false),
    parentPeriodId: text('parent_period_id'),
    seatRole: text('seat_role').notNull().default(''),
    reminderExpiringSentAt: timestamp('reminder_expiring_sent_at', { withTimezone: true }),
    reminderTrialSentAt: timestamp('reminder_trial_sent_at', { withTimezone: true }),
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

/** Seat pool members for a parent period (group membership). */
export const sfSubSeats = pgTable(
  'sf_sub_seats',
  {
    id: text('id').primaryKey(),
    periodId: text('period_id')
      .notNull()
      .references(() => sfSubPeriods.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    /** admin | member */
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_sub_seats_period_id_idx').on(table.periodId),
    index('sf_sub_seats_user_id_idx').on(table.userId),
    uniqueIndex('sf_sub_seats_period_user_uidx').on(table.periodId, table.userId),
  ],
)
