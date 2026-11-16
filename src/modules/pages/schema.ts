/**
 * product:pages tables (sf_pages_*).
 * Included via the host Drizzle schema glob under src/modules.
 * Page tags and categories live here. Do not reuse sf_media_tags / sf_media_categories.
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Editorial page category — one per page. Distinct from page tags. */
export const sfPagesCategories = pgTable(
  'sf_pages_categories',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default('Untitled category'),
    /** Admin / filter key. */
    slug: text('slug').notNull().default(''),
    description: text('description').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_pages_categories_slug_uidx').on(table.slug),
    index('sf_pages_categories_sort_idx').on(table.sortOrder),
  ],
)

/** Editorial page. Slug is shared across locales (including `home`). */
export const sfPages = pgTable(
  'sf_pages',
  {
    id: text('id').primaryKey(),
    /** Public slug. `home` is the site root (`/{locale}`). */
    slug: text('slug').notNull(),
    /** `draft` | `published` | `unpublished`. */
    status: text('status').notNull().default('draft'),
    /** Default-locale title. Other locales live in content-locale files. */
    title: text('title').notNull().default(''),
    /** Default-locale TipTap HTML. */
    body: text('body').notNull().default(''),
    /** Default-locale SEO title. */
    metaTitle: text('meta_title').notNull().default(''),
    /** Default-locale SEO description. */
    metaDescription: text('meta_description').notNull().default(''),
    /** product:media id (text). Shared across locales. No cross-pack FK. */
    metaMediaId: text('meta_media_id').notNull().default(''),
    /** Editorial category. Null = uncategorized. Distinct from page tags. */
    categoryId: text('category_id').references(() => sfPagesCategories.id, {
      onDelete: 'set null',
    }),
    /**
     * Payload `pages.id` for the one-shot 3b copy. New rows leave this null.
     * The Starforge id is a uuid so Nav does not coerce it back to a number.
     */
    payloadLegacyId: integer('payload_legacy_id'),
    /** Set once locale files and HTML bodies have been written from Payload. */
    payloadContentCopiedAt: timestamp('payload_content_copied_at', { withTimezone: true }),
    /**
     * Stamped when status becomes `published`. Kept after unpublish.
     * Null until the first publish.
     */
    publishedAt: timestamp('published_at', { withTimezone: true }),
    /** Core `sf_users.id` of the editor who created the row. Plain text, no FK. */
    createdByUserId: text('created_by_user_id').notNull().default(''),
    /** Core `sf_users.id` of the editor who last published. Plain text, no FK. */
    publishedByUserId: text('published_by_user_id').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_pages_slug_uidx').on(table.slug),
    index('sf_pages_status_idx').on(table.status),
    index('sf_pages_updated_at_idx').on(table.updatedAt),
    index('sf_pages_published_at_idx').on(table.publishedAt),
    index('sf_pages_category_id_idx').on(table.categoryId),
    uniqueIndex('sf_pages_legacy_idx').on(table.payloadLegacyId),
  ],
)

/** Page taxonomy. Distinct from media tags. */
export const sfPagesTags = pgTable(
  'sf_pages_tags',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    /** Payload `tags.id` when this row was copied for a page. */
    payloadLegacyId: integer('payload_legacy_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_pages_tags_slug_uidx').on(table.slug),
    uniqueIndex('sf_pages_tags_legacy_idx').on(table.payloadLegacyId),
  ],
)

/**
 * Last N saved states per page (restore list). Not a Payload version diff.
 * `payload_legacy_id` is the `_pages_v.id` when the row was copied.
 */
export const sfPagesVersions = pgTable(
  'sf_pages_versions',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => sfPages.id, { onDelete: 'cascade' }),
    payloadLegacyId: integer('payload_legacy_id'),
    title: text('title').notNull().default(''),
    body: text('body').notNull().default(''),
    metaTitle: text('meta_title').notNull().default(''),
    metaDescription: text('meta_description').notNull().default(''),
    metaMediaId: text('meta_media_id').notNull().default(''),
    slug: text('slug').notNull().default(''),
    status: text('status').notNull().default('draft'),
    /** Comma-separated tag titles at snapshot time. */
    tags: text('tags').notNull().default(''),
    /** Category id at snapshot time. Empty = none. */
    categoryId: text('category_id').notNull().default(''),
    locales: jsonb('locales')
      .$type<{
        title: Record<string, string>
        body: Record<string, string>
        metaTitle: Record<string, string>
        metaDescription: Record<string, string>
      }>()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_pages_versions_page_idx').on(table.pageId, table.createdAt),
    uniqueIndex('sf_pages_versions_legacy_idx').on(table.payloadLegacyId),
  ],
)

/** Page ↔ page-tag. Intra-pack FKs only. */
export const sfPagesPageTags = pgTable(
  'sf_pages_page_tags',
  {
    pageId: text('page_id')
      .notNull()
      .references(() => sfPages.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => sfPagesTags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.pageId, table.tagId] }),
    index('sf_pages_page_tags_tag_idx').on(table.tagId),
  ],
)
