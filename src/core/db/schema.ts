import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

/**
 * Starforge core tables (public schema).
 * Prefixed `sf_` so names never collide with Payload's `payload` schema tables.
 *
 * Auth/session tables will grow here later — this is the ownership boundary.
 */
export const sfUsers = pgTable('sf_users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
