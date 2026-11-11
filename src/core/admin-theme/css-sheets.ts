/**
 * Admin theme id → Core + Payload chrome sheets.
 *
 * Turbopack cannot place a `.css` asset into an ESM chunk via `require()` /
 * dynamic `import()` of the stylesheet itself. `import-active-*-chrome.ts`
 * statically imports a JS module per sheet (`load-*-chrome.ts`) that in turn
 * statically `import`s the `.css` — same mechanism as a layout-level CSS import.
 *
 * `active-core.css` / `active-payload.css` remain human pointers only — nested
 * CSS `@import` through those files is unreliable under Turbopack.
 */
import { STARFORGE_GANTRY_THEME_ID } from './themes/starforge-gantry'

export type AdminThemeCssSheets = {
  readonly core: string
  readonly payload: string
}

/**
 * Registry of chrome sheets per theme id. Live loaders are
 * `themes/<id>/load-*-chrome.ts` (static CSS import); keep those in sync.
 */
export const ADMIN_THEME_CSS_SHEETS = {
  [STARFORGE_GANTRY_THEME_ID]: {
    core: './themes/starforge-gantry/core-chrome.css',
    payload: './themes/starforge-gantry/payload-chrome.css',
  },
} as const satisfies Record<string, AdminThemeCssSheets>
