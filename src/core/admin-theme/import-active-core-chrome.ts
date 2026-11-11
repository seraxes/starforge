/**
 * Side-effect: Core `/admin` chrome for the active admin theme.
 * Import from the Core admin layout only — not the public root layout.
 *
 * Turbopack cannot place a `.css` asset into an ESM chunk via `require()` or
 * dynamic `import()` of the stylesheet. Each registered theme arm gets a
 * static ESM import of `load-core-chrome.ts`, which imports the sheet
 * (ADMIN_THEME_CSS_SHEETS). The switch selects the active id.
 */
import { ADMIN_THEME_CSS_SHEETS } from './css-sheets'
import { getActiveAdminThemeId } from './registry'
import { STARFORGE_GANTRY_THEME_ID } from './themes/starforge-gantry'
// starforge-gantry arm — static path the bundler can see (wraps core-chrome.css).
import './themes/starforge-gantry/load-core-chrome'

switch (getActiveAdminThemeId()) {
  case STARFORGE_GANTRY_THEME_ID:
    void ADMIN_THEME_CSS_SHEETS[STARFORGE_GANTRY_THEME_ID].core
    break
  default:
    void ADMIN_THEME_CSS_SHEETS[STARFORGE_GANTRY_THEME_ID].core
    break
}
