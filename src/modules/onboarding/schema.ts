/**
 * product:onboarding tables (sf_onboarding_*).
 * Included via drizzle.config schema glob under src/modules.
 *
 * Slice 2: status catalog + identity facts. No events, notes, training, or workers.
 * Cross-pack ids (Core user, Forms definition, Fleet station) are plain text — no FKs.
 */

import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Named recruiting / driver status. Staff can add more. Optional Forms definition. */
export const sfOnboardingStatuses = pgTable(
  'sf_onboarding_statuses',
  {
    id: text('id').primaryKey(),
    /** Stable key — e.g. recruiting, active, banned. Unique. */
    key: text('key').notNull(),
    name: text('name').notNull().default(''),
    /** When true, the person is bookable without Fleet vehicle access. */
    bookable: boolean('bookable').notNull().default(false),
    /** Optional Forms definition id (plain text). Empty = no intake (e.g. banned). */
    formDefinitionId: text('form_definition_id').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_onboarding_statuses_key_uidx').on(table.key),
    index('sf_onboarding_statuses_sort_idx').on(table.sortOrder),
    index('sf_onboarding_statuses_bookable_idx').on(table.bookable),
  ],
)

/**
 * Identity facts hung on the Core user id.
 * Name and email stay on the Core user — not copied here.
 * Phone falls back to Profiles only when this phone fact is missing.
 */
export const sfOnboardingIdentityFacts = pgTable(
  'sf_onboarding_identity_facts',
  {
    /** Core user id (plain text). */
    userId: text('user_id').primaryKey(),
    /** Current status id (plain text; no FK). */
    statusId: text('status_id').notNull().default(''),
    /**
     * Driver code — unique when set, up to 6 chars.
     * Null / omitted when unset (unique index allows multiple nulls).
     */
    driverCode: text('driver_code'),
    /** Onboarding phone. Blank → Profiles fallback on read. */
    phone: text('phone').notNull().default(''),
    /** Fleet station id. Catalog comes from Fleet; this pack only stores the id. */
    stationId: text('station_id').notNull().default(''),
    homeRunAllow: boolean('home_run_allow').notNull().default(false),
    homeRunFreeKm: integer('home_run_free_km').notNull().default(0),
    trainer: boolean('trainer').notNull().default(false),
    clearquote: text('clearquote').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_onboarding_identity_driver_code_uidx').on(table.driverCode),
    index('sf_onboarding_identity_status_idx').on(table.statusId),
    index('sf_onboarding_identity_station_idx').on(table.stationId),
  ],
)
