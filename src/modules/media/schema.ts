/**
 * product:media tables.
 * Included via drizzle.config schema glob under src/modules.
 *
 * Document store (phase 2b): assets, nested categories, media-tags, and the
 * asset↔tag junction. Blobs are not in these rows — MediaStorage holds them.
 * `sf_media_owners` is the member upload ledger (media id text, same id space).
 *
 * Migrated ids are the Payload numeric id as text so existing mediaId binds
 * stay valid. New rows use a uuid text id. `payload_legacy_id` is the one-shot
 * copy key.
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Relative (not `@/`) — drizzle-kit loads module schemas without the tsconfig alias.
import type { MediaSizesJson } from '../../core/media/media-record'
import { sfUsers } from '../../core/db/schema'

export const sfMediaCategories = pgTable(
  'sf_media_categories',
  {
    id: text('id').primaryKey(),
    payloadLegacyId: integer('payload_legacy_id'),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    parentId: text('parent_id'),
    path: text('path'),
    depth: integer('depth').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sf_media_categories_slug_idx').on(table.slug),
    uniqueIndex('sf_media_categories_legacy_idx').on(table.payloadLegacyId),
    index('sf_media_categories_parent_idx').on(table.parentId),
  ],
)

export const sfMediaTags = pgTable(
  'sf_media_tags',
  {
    id: text('id').primaryKey(),
    payloadLegacyId: integer('payload_legacy_id'),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sf_media_tags_slug_idx').on(table.slug),
    uniqueIndex('sf_media_tags_legacy_idx').on(table.payloadLegacyId),
  ],
)

export const sfMediaAssets = pgTable(
  'sf_media_assets',
  {
    id: text('id').primaryKey(),
    payloadLegacyId: integer('payload_legacy_id'),
    alt: text('alt').notNull(),
    mimeType: text('mime_type'),
    filename: text('filename'),
    filesize: integer('filesize'),
    width: integer('width'),
    height: integer('height'),
    purpose: text('purpose').notNull().default('photo'),
    folder: text('folder').notNull().default('general'),
    isPrivate: boolean('private').notNull().default(false),
    categoryId: text('category_id'),
    url: text('url'),
    path: text('path'),
    sizes: jsonb('sizes').$type<MediaSizesJson | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('sf_media_assets_legacy_idx').on(table.payloadLegacyId),
    uniqueIndex('sf_media_assets_filename_idx').on(table.filename),
    index('sf_media_assets_category_idx').on(table.categoryId),
    index('sf_media_assets_created_idx').on(table.createdAt),
    index('sf_media_assets_folder_idx').on(table.folder),
  ],
)

export const sfMediaAssetTags = pgTable(
  'sf_media_asset_tags',
  {
    assetId: text('asset_id').notNull(),
    tagId: text('tag_id').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'sf_media_asset_tags_pk',
      columns: [table.assetId, table.tagId],
    }),
    index('sf_media_asset_tags_tag_idx').on(table.tagId),
  ],
)

export const sfMediaOwners = pgTable(
  'sf_media_owners',
  {
    /** Asset id in `sf_media_assets` (migrated rows keep the Payload id as text). */
    mediaId: text('media_id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => sfUsers.id, { onDelete: 'cascade' }),
    /** Free label for the upload surface, e.g. `profile-avatar`, `profile-cover`. */
    context: text('context').notNull().default('general'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('sf_media_owners_user_idx').on(table.userId, table.context)],
)
