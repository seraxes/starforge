/**
 * product:events tables (sf_venues / sf_events).
 * Included via drizzle.config schema glob under src/modules.
 */

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/** Venue place entity — name, address, cover media, ACL tags. */
export const sfVenues = pgTable(
  'sf_venues',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().default('Untitled venue'),
    /** Free-form address / place text (Maps geo binder lands later). */
    address: text('address').notNull().default(''),
    /** Shared Media Manager id — cover image. */
    coverMediaId: text('cover_media_id'),
    /**
     * Viewing ACL tags: `public` | `registered` | `group:<id>`.
     * Empty / omit = public (OR match).
     */
    accessTags: jsonb('access_tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('sf_venues_name_idx').on(table.name)],
)

/** Event entity — schedule, venue ref, status, Media cover, capacity, ACL. */
export const sfEvents = pgTable(
  'sf_events',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull().default('Untitled event'),
    /** Optional public slug (particles / routes in PR2). */
    slug: text('slug'),
    /** draft | published | cancelled */
    status: text('status').notNull().default('draft'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    /** IANA timezone id (e.g. Europe/Budapest). */
    timezone: text('timezone').notNull().default('UTC'),
    venueId: text('venue_id').references(() => sfVenues.id, {
      onDelete: 'set null',
    }),
    /** Plain/HTML description for PR1 — rich editor can bind later. */
    description: text('description').notNull().default(''),
    coverMediaId: text('cover_media_id'),
    /** Gallery media ids from the shared Media library. */
    galleryMediaIds: jsonb('gallery_media_ids').$type<string[]>().notNull().default([]),
    /** Null = unlimited. */
    capacity: integer('capacity'),
    accessTags: jsonb('access_tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_events_status_idx').on(table.status),
    index('sf_events_starts_at_idx').on(table.startsAt),
    index('sf_events_venue_id_idx').on(table.venueId),
    index('sf_events_slug_idx').on(table.slug),
  ],
)
