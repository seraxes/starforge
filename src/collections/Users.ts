import type { CollectionConfig } from 'payload'

/**
 * Payload CMS editor accounts only.
 * App/product users live in Starforge core (`sf_*`) — never moved here.
 * Global admins get a *linked* editor via seed / `/app/admin/cms` (same email).
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    description:
      'CMS editors only — pages/media in /admin. Product accounts use /register + /login. Global app admins are auto-linked (same email) by npm run seed or Core admin → CMS access; members are never synced here.',
  },
  auth: true,
  fields: [],
}
