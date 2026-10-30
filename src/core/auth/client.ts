'use client'

import { createAuthClient } from 'better-auth/react'

/**
 * Browser client for Starforge app auth (register / login / logout / session).
 * Do not use this for Payload `/admin` CMS editors.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
})

export const { signIn, signUp, signOut, useSession } = authClient
