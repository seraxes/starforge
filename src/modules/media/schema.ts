/**
 * product:media tables — member upload ownership ledger.
 * Included via drizzle.config schema glob under src/modules.
 *
 * The Payload `media` collection stays the single library. Admin uploads are
 * unowned; **member** uploads (avatars, covers, later listing / post photos)
 * are recorded here so a member can only attach / manage images they uploaded.
 */

import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Relative (not `@/`) — drizzle-kit loads module schemas without the tsconfig alias.
import { sfUsers } from '../../core/db/schema'

export const sfMediaOwners = pgTable(
  'sf_media_owners',
  {
    /** Payload Media doc id. */
    mediaId: text('media_id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => sfUsers.id, { onDelete: 'cascade' }),
    /** Free label for the upload surface, e.g. `profile-avatar`, `profile-cover`. */
    context: text('context').notNull().default('general'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sf_media_owners_user_idx').on(table.userId, table.context),
  ],
)
