/**
 * product:maps live tactical tables (sf_map_*).
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
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/** Event-bound tactical map room. */
export const sfMapRooms = pgTable(
  'sf_map_rooms',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id').notNull(),
    title: text('title').notNull().default('Live map'),
    ownerUserId: text('owner_user_id').notNull(),
    /** When false, join/ingest rejected. */
    active: pgBoolean('active').notNull().default(true),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_map_rooms_event_id_idx').on(table.eventId),
    index('sf_map_rooms_owner_idx').on(table.ownerUserId),
    uniqueIndex('sf_map_rooms_event_unique').on(table.eventId),
  ],
)

/** Owner-appointed room admins (roster + overlay). */
export const sfMapRoomAdmins = pgTable(
  'sf_map_room_admins',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => sfMapRooms.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_map_room_admins_room_idx').on(table.roomId),
    uniqueIndex('sf_map_room_admins_room_user').on(table.roomId, table.userId),
  ],
)

/** Team inside a room. Optional ticket_tier_id for seed only. */
export const sfMapTeams = pgTable(
  'sf_map_teams',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => sfMapRooms.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Team'),
    color: text('color').notNull().default('#3b82f6'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Optional Events faction tier used when seeding — not live ACL. */
    ticketTierId: text('ticket_tier_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('sf_map_teams_room_idx').on(table.roomId),
    index('sf_map_teams_sort_idx').on(table.roomId, table.sortOrder),
  ],
)

/** Explicit roster — who may join and see same-team positions. */
export const sfMapTeamMembers = pgTable(
  'sf_map_team_members',
  {
    id: text('id').primaryKey(),
    teamId: text('team_id')
      .notNull()
      .references(() => sfMapTeams.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_map_team_members_team_idx').on(table.teamId),
    index('sf_map_team_members_user_idx').on(table.userId),
    uniqueIndex('sf_map_team_members_team_user').on(table.teamId, table.userId),
  ],
)

/** Active / historical join sessions. */
export const sfMapSessions = pgTable(
  'sf_map_sessions',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => sfMapRooms.id, { onDelete: 'cascade' }),
    teamId: text('team_id')
      .notNull()
      .references(() => sfMapTeams.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp('left_at', { withTimezone: true }),
  },
  (table) => [
    index('sf_map_sessions_room_idx').on(table.roomId),
    index('sf_map_sessions_user_idx').on(table.userId),
    index('sf_map_sessions_active_idx').on(table.roomId, table.userId, table.leftAt),
  ],
)

/** Last-known position for an active session (1 row per session). */
export const sfMapPositions = pgTable(
  'sf_map_positions',
  {
    sessionId: text('session_id')
      .primaryKey()
      .references(() => sfMapSessions.id, { onDelete: 'cascade' }),
    roomId: text('room_id').notNull(),
    teamId: text('team_id').notNull(),
    userId: text('user_id').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    accuracy: doublePrecision('accuracy'),
    heading: doublePrecision('heading'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_map_positions_team_idx').on(table.teamId),
    index('sf_map_positions_room_idx').on(table.roomId),
  ],
)

/**
 * Overlay: point marker or KML/KMZ media reference.
 * kind: point | kml
 * pointKind: base | poi (when kind=point)
 */
export const sfMapOverlays = pgTable(
  'sf_map_overlays',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id')
      .notNull()
      .references(() => sfMapRooms.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('point'),
    pointKind: text('point_kind').notNull().default('poi'),
    label: text('label').notNull().default(''),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    /** Shared Media library id for KML/KMZ (or GeoJSON blob). */
    mediaId: text('media_id'),
    /** Optional parsed GeoJSON FeatureCollection for KML placemarks. */
    geojson: jsonb('geojson'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('sf_map_overlays_room_idx').on(table.roomId)],
)
