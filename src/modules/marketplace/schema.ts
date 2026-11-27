/**
 * product:marketplace tables (sf_marketplace_*).
 * Included via drizzle.config schema glob under src/modules.
 *
 * Slice 3: categories + listings. Slice 5: saves. Slice 6: inquiries / messages / offers.
 * Slice 7: ratings. Title / description for categories live in content-locale files.
 * Listing title / description are seller text on the row.
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
  uniqueIndex,
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

/**
 * Buyer save of a listing. Unique (userId, listingId).
 * Second save of the same pair is a no-op success (no second row).
 */
export const sfMarketplaceSaves = pgTable(
  'sf_marketplace_saves',
  {
    id: text('id').primaryKey(),
    /** Core user id of the saver (plain text; no FK). */
    userId: text('user_id').notNull(),
    /** Listing id (plain text; no FK to sf_marketplace_listings). */
    listingId: text('listing_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_marketplace_saves_user_listing_uidx').on(table.userId, table.listingId),
    index('sf_marketplace_saves_user_idx').on(table.userId),
    index('sf_marketplace_saves_listing_idx').on(table.listingId),
  ],
)

/**
 * Listing-scoped inquiry thread. Unique (listingId, buyerUserId).
 * Not a general DM — one thread per listing and buyer.
 */
export const sfMarketplaceInquiries = pgTable(
  'sf_marketplace_inquiries',
  {
    id: text('id').primaryKey(),
    /** Listing id (plain text; no FK to sf_marketplace_listings). */
    listingId: text('listing_id').notNull(),
    /** Core user id of the buyer (plain text; no FK). */
    buyerUserId: text('buyer_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_marketplace_inquiries_listing_buyer_uidx').on(
      table.listingId,
      table.buyerUserId,
    ),
    index('sf_marketplace_inquiries_listing_idx').on(table.listingId),
    index('sf_marketplace_inquiries_buyer_idx').on(table.buyerUserId),
  ],
)

/**
 * Message on an inquiry. kind is text | availability (“Ask if available”).
 */
export const sfMarketplaceMessages = pgTable(
  'sf_marketplace_messages',
  {
    id: text('id').primaryKey(),
    /** Inquiry id (plain text; no FK to sf_marketplace_inquiries). */
    inquiryId: text('inquiry_id').notNull(),
    /** Core user id of the author (plain text; no FK). */
    authorUserId: text('author_user_id').notNull(),
    body: text('body').notNull().default(''),
    /** text | availability */
    kind: text('kind').notNull().default('text'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_marketplace_messages_inquiry_idx').on(table.inquiryId),
    index('sf_marketplace_messages_author_idx').on(table.authorUserId),
  ],
)

/**
 * Offer on an inquiry. One open offer per inquiry (enforced in offer-rules).
 * Accept does not charge the amount — local private deal.
 */
export const sfMarketplaceOffers = pgTable(
  'sf_marketplace_offers',
  {
    id: text('id').primaryKey(),
    /** Inquiry id (plain text; no FK to sf_marketplace_inquiries). */
    inquiryId: text('inquiry_id').notNull(),
    /** Offered amount in minor units (integer ≥ 0). */
    amountMinor: integer('amount_minor').notNull().default(0),
    /** open | accepted | declined */
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_marketplace_offers_inquiry_idx').on(table.inquiryId),
    index('sf_marketplace_offers_status_idx').on(table.status),
  ],
)

/**
 * Buyer/seller rating after a handoff (sold-to or accepted offer).
 * Unique (fromUserId, listingId, direction). Destination for migrated
 * marketplace user ratings — source column map stays TODO until an export exists.
 */
export const sfMarketplaceRatings = pgTable(
  'sf_marketplace_ratings',
  {
    id: text('id').primaryKey(),
    /** Rater core user id (plain text; no FK). */
    fromUserId: text('from_user_id').notNull(),
    /** Ratee core user id (plain text; no FK). */
    toUserId: text('to_user_id').notNull(),
    /** Listing id (plain text; no FK to sf_marketplace_listings). */
    listingId: text('listing_id').notNull(),
    /** buyer_rates_seller | seller_rates_buyer */
    direction: text('direction').notNull(),
    /** Integer 1–5. */
    score: integer('score').notNull(),
    note: text('note').notNull().default(''),
    /** Staff may hide; hidden ratings are excluded from the public average. */
    hidden: boolean('hidden').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_marketplace_ratings_from_listing_direction_uidx').on(
      table.fromUserId,
      table.listingId,
      table.direction,
    ),
    index('sf_marketplace_ratings_to_idx').on(table.toUserId),
    index('sf_marketplace_ratings_listing_idx').on(table.listingId),
    index('sf_marketplace_ratings_from_idx').on(table.fromUserId),
    index('sf_marketplace_ratings_hidden_idx').on(table.hidden),
  ],
)
