import type { CollectionConfig } from 'payload'

/**
 * Payload CMS editor accounts only.
 * App/product users will live in Starforge core (`src/core/`) — not this collection.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    description: 'CMS editors for the Payload content module (not Starforge app users).',
  },
  auth: true,
  fields: [],
}
