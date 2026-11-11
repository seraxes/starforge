'use client'

import { createAuthClient } from 'better-auth/react'
import {
  adminClient,
  emailOTPClient,
  magicLinkClient,
  twoFactorClient,
} from 'better-auth/client/plugins'

import { ac, appRoles } from './permissions'

/**
 * Browser client for Starforge app auth.
 * Omit `baseURL` — better-auth 1.7+ rejects relative paths like `/api/auth`.
 * Same-origin: the browser client resolves from `window.location.origin`
 * (works for both localhost and 127.0.0.1). Default path stays `/api/auth`.
 * Do not use this for Payload `/cms/admin` CMS editors.
 */
export const authClient = createAuthClient({
  plugins: [
    adminClient({
      ac,
      roles: appRoles,
    }),
    twoFactorClient({
      twoFactorPage: '/two-factor',
    }),
    magicLinkClient(),
    emailOTPClient(),
  ],
})
