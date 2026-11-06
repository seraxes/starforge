/**
 * product:events tables (sf_venues / sf_events / registrations / ticket tiers).
 * Included via drizzle.config schema glob under src/modules.
 */

import {
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/** Venue place entity — name, address, optional geo, cover media, ACL tags. */
export const sfVenues = pgTable(
  'sf_venues',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().default('Untitled venue'),
    /** Free-form address / place text (Maps geo binder). */
    address: text('address').notNull().default(''),
    /** WGS84 latitude (nullable until geocoded / set). */
    latitude: doublePrecision('latitude'),
    /** WGS84 longitude (nullable until geocoded / set). */
    longitude: doublePrecision('longitude'),
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
    /** Optional public slug (particles / routes). */
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
    /** Sanitized HTML description (product:rich-editor / TipTap). */
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

/**
 * Ticket tiers / slots per event.
 * `kind`: general | faction.
 */
export const sfEventTicketTiers = pgTable(
  'sf_event_ticket_tiers',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => sfEvents.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Ticket'),
    description: text('description').notNull().default(''),
    kind: text('kind').notNull().default('general'),
    capacity: integer('capacity'),
    priceLabel: text('price_label').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_event_ticket_tiers_event_id_idx').on(table.eventId),
    index('sf_event_ticket_tiers_sort_idx').on(table.eventId, table.sortOrder),
  ],
)

/**
 * Event registration rows (Forms event-registration → onSubmitted).
 * Status: registered | waitlisted | cancelled.
 */
export const sfEventRegistrations = pgTable(
  'sf_event_registrations',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => sfEvents.id, { onDelete: 'cascade' }),
    ticketTierId: text('ticket_tier_id').references(() => sfEventTicketTiers.id, {
      onDelete: 'set null',
    }),
    submissionId: text('submission_id'),
    userId: text('user_id'),
    name: text('name').notNull().default(''),
    email: text('email').notNull().default(''),
    guests: integer('guests').notNull().default(1),
    attendance: text('attendance').notNull().default('in_person'),
    notes: text('notes').notNull().default(''),
    status: text('status').notNull().default('registered'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_event_registrations_event_id_idx').on(table.eventId),
    index('sf_event_registrations_tier_id_idx').on(table.ticketTierId),
    index('sf_event_registrations_email_idx').on(table.email),
    index('sf_event_registrations_status_idx').on(table.status),
  ],
)
