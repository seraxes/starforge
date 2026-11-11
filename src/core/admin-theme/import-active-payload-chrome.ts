/**
 * Side-effect: Payload `/cms/admin` chrome for the active admin theme.
 * Import from the Payload layout only.
 *
 * Turbopack cannot place a `.css` asset into an ESM chunk via `require()` or
 * dynamic `import()` of the stylesheet. Each registered theme arm gets a
 * static ESM import of `load-payload-chrome.ts`, which imports the sheet
 * (ADMIN_THEME_CSS_SHEETS). The switch selects the active id.
 */
import { ADMIN_THEME_CSS_SHEETS } from './css-sheets'
import { getActiveAdminThemeId } from './registry'
import { STARFORGE_GANTRY_THEME_ID } from './themes/starforge-gantry'
// starforge-gantry arm — static path the bundler can see (wraps payload-chrome.css).
import './themes/starforge-gantry/load-payload-chrome'

switch (getActiveAdminThemeId()) {
  case STARFORGE_GANTRY_THEME_ID:
    void ADMIN_THEME_CSS_SHEETS[STARFORGE_GANTRY_THEME_ID].payload
    break
  default:
    void ADMIN_THEME_CSS_SHEETS[STARFORGE_GANTRY_THEME_ID].payload
    break
}
