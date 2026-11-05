/**
 * Smoke check: admin UI bugfix batch (mosaic, create actions, assets, auth toggles).
 * Run: npx tsx scripts/verify-admin-ui-bugfixes.mts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function mustInclude(haystack: string, label: string, needle: string) {
  if (!haystack.includes(needle)) {
    console.error(`missing ${label}: ${needle}`)
    process.exit(1)
  }
}

const styles = readFileSync(join(root, 'src/app/(frontend)/styles.css'), 'utf8')
const chrome = readFileSync(
  join(root, 'src/core/admin-theme/themes/starforge-gantry/core-chrome.css'),
  'utf8',
)
const localization = readFileSync(
  join(root, 'src/app/(frontend)/admin/localization/localization-form.tsx'),
  'utf8',
)
const mediaSettings = readFileSync(
  join(root, 'src/modules/media/admin/media-settings-form.tsx'),
  'utf8',
)
const authForm = readFileSync(
  join(root, 'src/app/(frontend)/admin/settings/auth/auth-settings-form.tsx'),
  'utf8',
)
const groups = readFileSync(
  join(root, 'src/app/(frontend)/admin/users/groups/groups-manager.tsx'),
  'utf8',
)
const pageSettings = readFileSync(
  join(root, 'src/app/(frontend)/admin/page-settings/page-settings-form.tsx'),
  'utf8',
)
const assetTypes = readFileSync(join(root, 'src/core/page-settings/types.ts'), 'utf8')
const documentShell = readFileSync(
  join(root, 'src/core/page-settings/document-shell.tsx'),
  'utf8',
)
const siteChromeTypes = readFileSync(join(root, 'src/core/site-chrome/types.ts'), 'utf8')

mustInclude(localization, 'localization mosaic', 'admin-settings-mosaic')
mustInclude(mediaSettings, 'media settings mosaic', 'admin-settings-mosaic')
mustInclude(styles, 'solo outlines-create full width', '.admin-settings-mosaic > .outlines-create')
mustInclude(styles, 'odd last fieldset full width', ':last-child:nth-child(odd)')
mustInclude(chrome, 'create submit bottom-right', 'grid-column: 1 / -1')
mustInclude(chrome, 'create submit justify end', 'justify-self: end')
mustInclude(chrome, 'nav add item align', '.admin-shell .nav-items-add .outlines-create-form')
mustInclude(groups, 'Rename gantry button', 'gantry-toolbar-btn secondary')
mustInclude(groups, 'no redundant Members action link', 'Name already opens members')
mustInclude(styles, 'no Actions nested expand-below margin', '.outlines-actions > .outlines-inline-form')
const formsManager = readFileSync(
  join(root, 'src/app/(frontend)/admin/forms/forms-manager.tsx'),
  'utf8',
)
mustInclude(formsManager, 'forms Dup uses admin-inline-form', 'form action={dupAction} className="admin-inline-form"')
mustInclude(formsManager, 'forms Delete uses admin-inline-form', 'form action={deleteAction} className="admin-inline-form"')
if (formsManager.includes('>Edit</') || formsManager.includes('>Edit\n')) {
  console.error('forms list still has redundant Edit action button')
  process.exit(1)
}
mustInclude(authForm, 'magic link toggle', 'authMagicLinkEnabled')
mustInclude(authForm, '2FA toggle', 'authTwoFactorEnabled')
mustInclude(siteChromeTypes, 'auth magic chrome field', 'authMagicLinkEnabled')
mustInclude(assetTypes, 'asset content field', 'content?: string')
mustInclude(assetTypes, 'asset priority field', 'priority?: number')
mustInclude(assetTypes, 'priority min', 'ASSET_PRIORITY_MIN')
mustInclude(pageSettings, 'CSS Add file', 'Add {fileLabel}')
mustInclude(pageSettings, 'Edit trigger', 'triggerLabel="Edit"')
mustInclude(pageSettings, 'CodeMirror language prop', "language={language}")
mustInclude(documentShell, 'sort assets', 'sortAssetsByPriority')

console.log('ok — admin UI bugfixes (mosaic, create, auth toggles, assets)')
