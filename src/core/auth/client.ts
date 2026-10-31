'use client'

import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'

import { ac, appRoles } from './permissions'

/**
 * Browser client for Starforge app auth.
 * Use a relative base URL so requests stay same-origin whether the page is
 * opened as http://localhost:3000 or http://127.0.0.1:3000.
 * Do not use this for Payload `/admin` CMS editors.
 */
export const authClient = createAuthClient({
  baseURL: '/api/auth',
  plugins: [
    adminClient({
      ac,
      roles: appRoles,
    }),
  ],
})
