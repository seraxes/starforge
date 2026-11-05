/**
 * Smoke: Assets/Custom CodeMirror uses Starforge admin Gantry theme
 * (not stock One Dark), and AtomSettingsPopover portals with dark chrome.
 * Run: npx tsx scripts/verify-codemirror-admin-theme.mts
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

function mustNotInclude(haystack: string, label: string, needle: string) {
  if (haystack.includes(needle)) {
    console.error(`unexpected ${label}: ${needle}`)
    process.exit(1)
  }
}

const theme = readFileSync(
  join(root, 'src/components/admin/starforge-admin-cm-theme.ts'),
  'utf8',
)
const editor = readFileSync(
  join(root, 'src/components/admin/CodeEditorField.tsx'),
  'utf8',
)
const popover = readFileSync(
  join(root, 'src/app/(frontend)/admin/page-settings/atom-settings-popover.tsx'),
  'utf8',
)
const chrome = readFileSync(
  join(root, 'src/core/admin-theme/themes/starforge-gantry/core-chrome.css'),
  'utf8',
)

mustInclude(theme, 'navy editor bg', "#0f1a2a")
mustInclude(theme, 'mid-blue accent', '#3498db')
mustInclude(theme, 'export theme extensions', 'starforgeAdminCmTheme')
mustInclude(editor, 'admin theme import', 'starforgeAdminCmTheme')
mustInclude(editor, 'no stock one-dark theme prop', 'theme="none"')
mustNotInclude(editor, 'stock dark theme string', 'theme="dark"')
mustInclude(popover, 'dark theme on portal layer', 'gantry-settings-theme-dark')
mustInclude(popover, 'preferredWidth prop', 'preferredWidth')
mustInclude(
  chrome,
  'portal CodeMirror gutters',
  '.gantry-settings-theme-dark .sf-code-mirror .cm-gutters',
)

console.log('ok — CodeMirror admin Gantry theme (portal + extensions)')
