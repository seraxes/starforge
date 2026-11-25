/**
 * product:ads tables (sf_ads_*).
 * Included via drizzle.config schema glob under src/modules.
 *
 * Slice 2: packages, placements, credits balance stub, campaigns.
 * No Payments cart / gateway tables. No Social writes.
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

/** Sellable ad SKU / credit bundle. Price owned here for later Payments snapshot. */
export const sfAdsPackages = pgTable(
  'sf_ads_packages',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    /** Major units (site currency). Snapshot later at checkout — do not call Payments here. */
    price: integer('price').notNull().default(0),
    /** Credits granted when a purchase is fulfilled (later Payments hook). */
    creditGrant: integer('credit_grant').notNull().default(0),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_ads_packages_active_idx').on(table.active),
    index('sf_ads_packages_sort_idx').on(table.sortOrder),
  ],
)

/** Where a creative may appear (e.g. social_feed). Rendering stays in Social / layout. */
export const sfAdsPlacements = pgTable(
  'sf_ads_placements',
  {
    id: text('id').primaryKey(),
    label: text('label').notNull().default(''),
    /** Stable key — e.g. social_feed. */
    key: text('key').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_ads_placements_key_uidx').on(table.key),
    index('sf_ads_placements_enabled_idx').on(table.enabled),
  ],
)

/**
 * Per-buyer credit balance stub.
 * Grant / spend land in later Payments + campaign slices — table only for now.
 */
export const sfAdsCredits = pgTable(
  'sf_ads_credits',
  {
    id: text('id').primaryKey(),
    buyerUserId: text('buyer_user_id').notNull(),
    balance: integer('balance').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_ads_credits_buyer_uidx').on(table.buyerUserId),
    index('sf_ads_credits_buyer_idx').on(table.buyerUserId),
  ],
)

/** Campaign binds buyer, package, placement(s), schedule, creative. No Social write yet. */
export const sfAdsCampaigns = pgTable(
  'sf_ads_campaigns',
  {
    id: text('id').primaryKey(),
    buyerUserId: text('buyer_user_id').notNull().default(''),
    packageId: text('package_id')
      .notNull()
      .references(() => sfAdsPackages.id, { onDelete: 'restrict' }),
    /** Placement ids this creative may use. */
    placementIds: jsonb('placement_ids').$type<string[]>().notNull().default([]),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    /** draft | pending | live | offline */
    status: text('status').notNull().default('draft'),
    /** Media library id — bytes stay in product:media. */
    creativeMediaId: text('creative_media_id').notNull().default(''),
    copyTitle: text('copy_title').notNull().default(''),
    copyBody: text('copy_body').notNull().default(''),
    /** Filled when Social publish lands (slice 4). */
    socialPostId: text('social_post_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_ads_campaigns_buyer_idx').on(table.buyerUserId),
    index('sf_ads_campaigns_package_idx').on(table.packageId),
    index('sf_ads_campaigns_status_idx').on(table.status),
  ],
)
