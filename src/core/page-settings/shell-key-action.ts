'use server'

import { sanitizePublicShellPath, type PublicShellKey } from './shell-key'
import { resolvePublicShellKeyFromPath } from './shell-key.server'

/** Public surround identity for a same-origin path. Used to detect a stale shell on soft nav. */
export async function resolvePublicShellKeyAction(
  pathname: string,
): Promise<PublicShellKey | null> {
  const path = sanitizePublicShellPath(pathname)
  if (!path) return null
  try {
    return await resolvePublicShellKeyFromPath(path)
  } catch {
    return null
  }
}
