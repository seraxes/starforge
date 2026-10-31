import type { CollectionConfig } from 'payload'

import { starforgeCoreSessionStrategy } from '@/core/cms-bridge/payload-strategy'

/**
 * Payload CMS editor stubs — product users stay in `sf_*`.
 *
 * Auth:
 * 1. Custom Better Auth strategy (server/API)
 * 2. Payload JWT (`payload-token`) issued from core session for the admin UI
 *
 * Local email/password login UI is replaced by a redirect to core `/login`.
 * Do NOT set disableLocalStrategy — JWT strategy requires local auth enabled.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    description:
      'CMS editor stubs linked to core app users (cms_access). Sign-in is Better Auth only — Payload password form is disabled. Manage CMS access under Starforge admin → Users.',
  },
  auth: {
    // JWT strategy must stay enabled for payload-token cookie exchange.
    useSessions: false,
    tokenExpiration: 60 * 60 * 8,
    cookies: {
      sameSite: 'Lax',
      secure: false,
    },
    // Better Auth first; local-jwt is appended by Payload when local strategy is on.
    strategies: [starforgeCoreSessionStrategy],
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    read: ({ req }) => Boolean(req.user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'coreUserId',
      type: 'text',
      unique: true,
      index: true,
      saveToJWT: true,
      admin: {
        readOnly: true,
        description: 'Starforge `sf_users.id` this CMS stub is linked to.',
      },
    },
  ],
}
