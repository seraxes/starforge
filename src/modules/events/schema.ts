/**
 * product:events tables (sf_venues / sf_events / registrations / ticket tiers).
 * Included via drizzle.config schema glob under src/modules.
 */

import {
  boolean as pgBoolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/** Venue place entity — name, address, description, geo, cover/gallery, ACL. */
export const sfVenues = pgTable(
  'sf_venues',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().default('Untitled venue'),
    /** Free-form address / place text (Maps geo binder). */
    address: text('address').notNull().default(''),
    /** HTML description (Rich Editor). */
    description: text('description').notNull().default(''),
    /** WGS84 latitude (nullable until geocoded / set). */
    latitude: doublePrecision('latitude'),
    /** WGS84 longitude (nullable until geocoded / set). */
    longitude: doublePrecision('longitude'),
    /** Shared Media Manager id — cover image. */
    coverMediaId: text('cover_media_id'),
    /** Extra Media library ids (gallery). */
    galleryMediaIds: jsonb('gallery_media_ids').$type<string[]>().notNull().default([]),
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
    /**
     * ISO 4217 checkout currency for this event.
     * Empty = Payments site currency.
     */
    currency: text('currency').notNull().default(''),
    /**
     * Event base price in major units (individual price).
     * A ticket type with its own price replaces this. Null = no event base.
     */
    price: integer('price'),
    /**
     * Event-level automatic adjustments. `{ time, sold }`.
     * Percent is of the price in effect (event base, or the ticket type price).
     */
    priceRules: jsonb('price_rules')
      .$type<{
        time: {
          withinMinutes: number
          mode: 'amount' | 'percent'
          value: number
        } | null
        sold: {
          threshold: number
          basis: 'count' | 'percent'
          mode: 'amount' | 'percent'
          value: number
        } | null
      }>()
      .notNull()
      .default({ time: null, sold: null }),
    venueId: text('venue_id').references(() => sfVenues.id, {
      onDelete: 'set null',
    }),
    /** Sanitized HTML description (product:rich-editor / TipTap). */
    description: text('description').notNull().default(''),
    coverMediaId: text('cover_media_id'),
    /**
     * Cover slider set (max 10). First id mirrors coverMediaId for cards/lists.
     * random/rotate display is Premium — persist now; public playback later.
     */
    coverMediaIds: jsonb('cover_media_ids').$type<string[]>().notNull().default([]),
    /** static | random | rotate — see EventCoverDisplayMode. */
    coverDisplayMode: text('cover_display_mode').notNull().default('static'),
    /** Gallery media ids from the shared Media library. */
    galleryMediaIds: jsonb('gallery_media_ids').$type<string[]>().notNull().default([]),
    /** Null = unlimited. */
    capacity: integer('capacity'),
    /** When full, public signup may join the waitlist (FIFO promote when seats free). */
    waitlistEnabled: pgBoolean('waitlist_enabled').notNull().default(true),
    /** Null = open when published. */
    registrationOpensAt: timestamp('registration_opens_at', { withTimezone: true }),
    /** Null = no hard close (beyond event status). */
    registrationClosesAt: timestamp('registration_closes_at', { withTimezone: true }),
    /**
     * Self-service cancel / Switch-to allowed until this time.
     * Null = self-cancel and Switch-to disabled.
     */
    cancellationClosesAt: timestamp('cancellation_closes_at', { withTimezone: true }),
    /**
     * When true, the public cancel form may offer a confirmed refund request
     * via product:payments (refunds themselves are not auto).
     */
    selfCancelRefund: pgBoolean('self_cancel_refund').notNull().default(false),
    /**
     * Premium merchant user who collects ticket money (own Barion / invoice keys).
     * Null = site MoR checkout via product:payments settings.
     */
    merchantUserId: text('merchant_user_id'),
    /** User ids who can manage this event (beyond app-admin). */
    managerUserIds: jsonb('manager_user_ids').$type<string[]>().notNull().default([]),
    /** User ids who can help edit (same write surface as managers for now). */
    helperUserIds: jsonb('helper_user_ids').$type<string[]>().notNull().default([]),
    /** Group ids granted manager rights. */
    managerGroupIds: jsonb('manager_group_ids').$type<string[]>().notNull().default([]),
    /** Group ids granted helper rights. */
    helperGroupIds: jsonb('helper_group_ids').$type<string[]>().notNull().default([]),
    /** Party ids shown as organizers (order preserved). */
    organizerPartyIds: jsonb('organizer_party_ids').$type<string[]>().notNull().default([]),
    /** Party ids shown as speakers. */
    speakerPartyIds: jsonb('speaker_party_ids').$type<string[]>().notNull().default([]),
    /** Party ids shown as sponsors. */
    sponsorPartyIds: jsonb('sponsor_party_ids').$type<string[]>().notNull().default([]),
    /** Related event ids (series / see-also). */
    relatedEventIds: jsonb('related_event_ids').$type<string[]>().notNull().default([]),
    /** Short note above the public registration form. */
    signupNote: text('signup_note').notNull().default(''),
    /** Terms / conditions page URL (CMS or external). */
    termsUrl: text('terms_url').notNull().default(''),
    /**
     * When false, published event is omitted from public lists/particles
     * (direct URL still works subject to ACL + optional password).
     */
    listed: pgBoolean('listed').notNull().default(true),
    /**
     * When true, event is eligible for the Featured / carousel particle
     * (layout-placed; not baked into the Events hub views).
     */
    featured: pgBoolean('featured').notNull().default(false),
    /** scrypt hash for optional shared access password; never expose to client. */
    accessPasswordHash: text('access_password_hash'),
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
    index('sf_events_listed_idx').on(table.listed),
    index('sf_events_featured_idx').on(table.featured),
    index('sf_events_merchant_user_id_idx').on(table.merchantUserId),
  ],
)

/**
 * Shared party profiles — organizers / speakers / sponsors (not a mini-CRM).
 * Linked from events via jsonb id lists.
 */
export const sfEventParties = pgTable(
  'sf_event_parties',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().default('Untitled'),
    /** organizer | speaker | sponsor | other — default role hint; events may still attach any party. */
    kind: text('kind').notNull().default('organizer'),
    url: text('url').notNull().default(''),
    blurb: text('blurb').notNull().default(''),
    avatarMediaId: text('avatar_media_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_event_parties_kind_idx').on(table.kind),
    index('sf_event_parties_name_idx').on(table.name),
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
    /** Card blurb on the public event page (falls back to description). */
    shortDescription: text('short_description').notNull().default(''),
    description: text('description').notNull().default(''),
    kind: text('kind').notNull().default('general'),
    capacity: integer('capacity'),
    /** Max tickets (guests) allowed on a single booking for this tier; null = default cap. */
    maxPerBooking: integer('max_per_booking'),
    /** Numeric base price (major units). Null = no amount; display may still use priceLabel. */
    price: integer('price'),
    /**
     * Ticket-type modifier value. Mode is `price_modifier_mode`.
     * Amount = major units; percent = points of the price in effect.
     */
    priceModifier: integer('price_modifier').notNull().default(0),
    /** `amount` | `percent` — typed in one field (`500` vs `10%`). */
    priceModifierMode: text('price_modifier_mode').notNull().default('amount'),
    /** Optional display text that overwrites the formatted price on public cards. */
    priceLabel: text('price_label').notNull().default(''),
    /**
     * Automatic adjustments on top of price + priceModifier.
     * `{ time, sold }` — one bracket each; see price-rules.ts.
     */
    priceRules: jsonb('price_rules')
      .$type<{
        time: {
          withinMinutes: number
          mode: 'amount' | 'percent'
          value: number
        } | null
        sold: {
          threshold: number
          basis: 'count' | 'percent'
          mode: 'amount' | 'percent'
          value: number
        } | null
      }>()
      .notNull()
      .default({ time: null, sold: null }),
    /** Public card title (h3) color — hex or empty for theme default. */
    titleColor: text('title_color').notNull().default(''),
    /** Public card border color — hex or empty for theme default. */
    borderColor: text('border_color').notNull().default(''),
    /** Public card background color — hex or empty for theme default. */
    backgroundColor: text('background_color').notNull().default(''),
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
    /** product:payments order id when tier requires payment. */
    paymentOrderId: text('payment_order_id'),
    /** Door check-in timestamp (manual staff mark). Null = not checked in. */
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }),
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
    index('sf_event_registrations_payment_order_id_idx').on(table.paymentOrderId),
    index('sf_event_registrations_checked_in_at_idx').on(table.checkedInAt),
  ],
)
