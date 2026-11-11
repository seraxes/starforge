import type { AdminTheme } from '../../types'

import { starforgeGantryTokens } from './tokens'

export const STARFORGE_GANTRY_THEME_ID = 'starforge-gantry' as const

/**
 * First admin theme: Gantry Helium–like dark navy + pastel orange/blue.
 * CSS: `load-core-chrome.ts` / `load-payload-chrome.ts` → sheets in ADMIN_THEME_CSS_SHEETS.
 */
export const starforgeGantryTheme: AdminTheme = {
  id: STARFORGE_GANTRY_THEME_ID,
  label: 'Starforge Gantry (dark)',
  dataAttr: STARFORGE_GANTRY_THEME_ID,
  payloadColorScheme: 'dark',
  tokens: starforgeGantryTokens,
}
