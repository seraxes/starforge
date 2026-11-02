import { starforgeGantryTheme, STARFORGE_GANTRY_THEME_ID } from './themes/starforge-gantry'
import type { AdminTheme, AdminThemeId, AdminThemeRegistry } from './types'

/**
 * Installed admin themes. Add a second package entry here when shipping another look;
 * wire CSS via `active-core.css` / `active-payload.css` imports (static Next CSS).
 */
const registry: AdminThemeRegistry = {
  [STARFORGE_GANTRY_THEME_ID]: starforgeGantryTheme,
}

const DEFAULT_THEME_ID: AdminThemeId = STARFORGE_GANTRY_THEME_ID

export function listAdminThemes(): AdminTheme[] {
  return Object.values(registry)
}

export function getAdminTheme(id: AdminThemeId): AdminTheme | null {
  return registry[id] ?? null
}

/**
 * Active theme id — env `STARFORGE_ADMIN_THEME` (default `starforge-gantry`).
 * Unknown ids fall back to the default so a typo never blanks chrome.
 */
export function getActiveAdminThemeId(): AdminThemeId {
  const raw = (process.env.STARFORGE_ADMIN_THEME ?? DEFAULT_THEME_ID).trim()
  if (raw && registry[raw]) return raw
  return DEFAULT_THEME_ID
}

export function getActiveAdminTheme(): AdminTheme {
  return registry[getActiveAdminThemeId()] ?? starforgeGantryTheme
}
