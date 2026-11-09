/**
 * Active skin’s preferred outline id — site Default shell for new pages / menus.
 */
import 'server-only'

import { DEFAULT_LAYOUT_ID } from '@/core/db'

import { getActiveSkin } from './resolve-active'

/** Preferred layout outline for the active skin, or Core `default` when unset. */
export async function getPreferredLayoutId(): Promise<string> {
  const skin = await getActiveSkin()
  const preferred =
    typeof skin.preferredDefaultOutlineId === 'string'
      ? skin.preferredDefaultOutlineId.trim()
      : ''
  return preferred || DEFAULT_LAYOUT_ID
}
