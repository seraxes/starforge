import type { CollectionConfig } from 'payload'

import { starforgeCoreSessionStrategy } from '@/core/cms-bridge/payload-strategy'

/**
 * Payload CMS editor stubs only — authenticated via Starforge Better Auth
 * (custom strategy). Product/app users live in `sf_*` and are never bulk-synced
 * here; only users with `sf_users.cms_access` get a linked row.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    description:
      'CMS editor stubs linked to core app users (cms_access). Sign-in is Better Auth only — no Payload password. Manage the CMS access toggle under Core admin → Users.',
  },
  auth: {
    // Core Better Auth is the only login; hide Payload email/password.
    disableLocalStrategy: true,
    useSessions: false,
    strategies: [starforgeCoreSessionStrategy],
  },
  access: {
    // Only authenticated (strategy) users reach admin; stubs are provisioned by core.
    admin: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'coreUserId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Starforge `sf_users.id` this CMS stub is linked to.',
      },
    },
  ],
}
