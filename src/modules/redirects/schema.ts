/**
 * product:redirects table (sf_redirects).
 * Included via the host Drizzle schema glob under src/modules.
 * Columns match the baseline migration — do not rename in a move pass.
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

/**
 * URL redirects (SF-130 / product:redirects).
 * The proxy hook looks up enabled rows by normalized from_path.
 */
export const sfRedirects = pgTable(
  'sf_redirects',
  {
    id: text('id').primaryKey(),
    /** Normalized path (leading slash, no trailing slash except `/`). */
    fromPath: text('from_path').notNull(),
    /** Destination path or absolute http(s) URL. */
    toPath: text('to_path').notNull(),
    /** HTTP status: 301 | 302 | 307 | 308. */
    statusCode: integer('status_code').notNull().default(301),
    enabled: boolean('enabled').default(true).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('sf_redirects_from_path_uidx').on(table.fromPath),
    index('sf_redirects_enabled_idx').on(table.enabled),
  ],
)
