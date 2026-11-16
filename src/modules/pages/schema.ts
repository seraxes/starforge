/**
 * product:pages tables (sf_pages_*).
 * Included via the host Drizzle schema glob under src/modules.
 * Page tags live here. Do not reuse sf_media_tags or the Payload tags collection.
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

/** Editorial page. Slug is shared across locales (including `home`). */
export const sfPages = pgTable(
  'sf_pages',
  {
    id: text('id').primaryKey(),
    /** Public slug. `home` is the site root (`/{locale}`). */
    slug: text('slug').notNull(),
    /** `draft` | `published`. */
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
    /**
     * Payload `pages.id` for the one-shot 3b copy. New rows leave this null.
     * The Starforge id is a uuid so Nav does not coerce it back to a number.
     */
    payloadLegacyId: integer('payload_legacy_id'),
    /** Set once locale files and HTML bodies have been written from Payload. */
    payloadContentCopiedAt: timestamp('payload_content_copied_at', { withTimezone: true }),
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
