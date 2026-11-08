/**
 * product:profiles tables — one persona row per user.
 * Included via drizzle.config schema glob under src/modules.
 *
 * `sf_users` stays the Core auth identity (email, password, role). This table is
 * the *public persona* layered on top — keyed by user id so every other module
 * stores `userId` and resolves identity through `@/modules/profiles/api.server`.
 */

import {
  date,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// Relative (not `@/`) — drizzle-kit loads module schemas without the tsconfig alias.
import { sfUsers } from '../../core/db/schema'

export const sfProfiles = pgTable(
  'sf_profiles',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => sfUsers.id, { onDelete: 'cascade' }),
    /** Lowercase unique public slug (`/u/[handle]`). */
    handle: text('handle').notNull(),
    /** Null until the member (or an admin) first changes the auto-assigned handle. */
    handleChangedAt: timestamp('handle_changed_at', { withTimezone: true }),
    displayName: text('display_name').notNull().default(''),
    headline: text('headline').notNull().default(''),
    bio: text('bio').notNull().default(''),
    /** Shared Media library id (member-uploaded or admin-picked). */
    avatarMediaId: text('avatar_media_id').notNull().default(''),
    coverMediaId: text('cover_media_id').notNull().default(''),
    /** Social-style crop: `{ x, y, zoom }` focal point (0–100) + zoom (1–3). */
    avatarFrame: jsonb('avatar_frame')
      .$type<{ x: number; y: number; zoom: number }>()
      .notNull()
      .default({ x: 50, y: 50, zoom: 1 }),
    coverFrame: jsonb('cover_frame')
      .$type<{ x: number; y: number; zoom: number }>()
      .notNull()
      .default({ x: 50, y: 50, zoom: 1 }),
    birthDate: date('birth_date', { mode: 'string' }),
    gender: text('gender').notNull().default(''),
    /** ISO 3166-1 alpha-2. */
    country: text('country').notNull().default(''),
    city: text('city').notNull().default(''),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    website: text('website').notNull().default(''),
    phone: text('phone').notNull().default(''),
    /** `[{ label, url }]`, max 6, http(s) only. */
    links: jsonb('links').$type<Array<{ label: string; url: string }>>().notNull().default([]),
    /** Preferred UI locale code (empty = site default). */
    locale: text('locale').notNull().default(''),
    /** IANA time zone (empty = site default). */
    timezone: text('timezone').notNull().default(''),
    /** Member-chosen scope per field: `{ city: 'registered', phone: 'private' }`. */
    visibility: jsonb('visibility').$type<Record<string, string>>().notNull().default({}),
    /** Hero seam — vertical fields namespaced per pack: `{ "hero:asn": { teamName } }`. */
    extensions: jsonb('extensions')
      .$type<Record<string, Record<string, unknown>>>()
      .notNull()
      .default({}),
    /** `active` | `hidden` (admin-hidden: public page 404s, persona stays minimal). */
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_profiles_handle_uidx').on(table.handle),
    index('sf_profiles_status_idx').on(table.status),
    index('sf_profiles_country_idx').on(table.country),
  ],
)
