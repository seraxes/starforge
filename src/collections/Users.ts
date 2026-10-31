import type { CollectionConfig } from 'payload'

/**
 * Payload CMS editor accounts only.
 * App/product users will live in Starforge core (`src/core/`) — not this collection.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    description:
      'CMS editors only — edit pages/media in Payload /admin. Product app accounts use /register and /login (Better Auth); they are not listed here.',
  },
  auth: true,
  fields: [],
}
