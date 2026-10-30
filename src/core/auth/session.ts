import { headers } from 'next/headers'

import { auth } from './index'

/** Server-side session helper for RSC / route handlers. */
export async function getAppSession() {
  return auth.api.getSession({
    headers: await headers(),
  })
}
