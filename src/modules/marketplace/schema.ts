/**
 * product:marketplace tables (sf_marketplace_*).
 * Included via drizzle.config schema glob under src/modules.
 *
 * Slice 3: categories + listings. Title / description for categories live in
 * content-locale files. Listing title / description are seller text on the row.
 * Cross-pack ids are plain text — no foreign keys to other packs.
 */

import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/** Admin category tree. Disabled categories hide listings from the public query. */
export const sfMarketplaceCategories = pgTable(
  'sf_marketplace_categories',
  {
    id: text('id').primaryKey(),
    /** Public / filter key. Built from the title when blank. */
    slug: text('slug'),
    /** Optional parent category id (plain text; no FK). Empty/null = top level. */
    parentId: text('parent_id'),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_marketplace_categories_slug_idx').on(table.slug),
    index('sf_marketplace_categories_sort_idx').on(table.sortOrder),
    index('sf_marketplace_categories_parent_idx').on(table.parentId),
    index('sf_marketplace_categories_enabled_idx').on(table.enabled),
  ],
)

/**
 * Classified listing. Item price is a displayed minor-unit integer (or free);
 * it is not a Payments line. Optional listing fee is slice 9.
 */
export const sfMarketplaceListings = pgTable(
  'sf_marketplace_listings',
  {
    id: text('id').primaryKey(),
    /** Core user id of the seller (plain text; no FK). */
    sellerUserId: text('seller_user_id').notNull(),
    /** Category id (plain text; no FK to sf_marketplace_categories). */
    categoryId: text('category_id').notNull().default(''),
    title: text('title').notNull().default(''),
    description: text('description').notNull().default(''),
    /** Minor units. Null = free. */
    priceMinor: integer('price_minor'),
    /** new | used | refurbished */
    condition: text('condition').notNull().default('used'),
    /**
     * draft | active | pending | sold | hidden | removed | expired
     */
    status: text('status').notNull().default('draft'),
    /** Coarse public place label (not a street address). */
    areaLabel: text('area_label').notNull().default(''),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** Buyer user id when marked sold (plain text; no FK). */
    soldToUserId: text('sold_to_user_id'),
    /** Ordered Media library ids. Cap from module settings. */
    mediaIds: jsonb('media_ids').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_marketplace_listings_seller_idx').on(table.sellerUserId),
    index('sf_marketplace_listings_category_idx').on(table.categoryId),
    index('sf_marketplace_listings_status_idx').on(table.status),
    index('sf_marketplace_listings_expires_idx').on(table.expiresAt),
  ],
)
