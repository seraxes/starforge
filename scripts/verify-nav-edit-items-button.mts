/**
 * Guard: Navigation list actions stay compact Gantry toolbar buttons
 * (Edit items / Rename / Duplicate) — not bare `.secondary` text chips and
 * not stripped by generic admin `a` color rules.
 *
 * Run: npx tsx scripts/verify-nav-edit-items-button.mts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')

function mustInclude(path: string, needles: string[], label: string) {
  const text = readFileSync(resolve(root, path), 'utf8')
  for (const needle of needles) {
    if (!text.includes(needle)) {
      console.error(`[fail] ${label}: missing ${JSON.stringify(needle)} in ${path}`)
      process.exit(1)
    }
  }
  console.log(`[ok] ${label}`)
}

function mustMatch(path: string, re: RegExp, label: string) {
  const text = readFileSync(resolve(root, path), 'utf8')
  if (!re.test(text)) {
    console.error(`[fail] ${label}: ${re} not found in ${path}`)
    process.exit(1)
  }
  console.log(`[ok] ${label}`)
}

const navManager = 'src/app/(frontend)/admin/nav/nav-menus-manager.tsx'
const chrome = 'src/core/admin-theme/themes/starforge-gantry/core-chrome.css'

mustMatch(
  navManager,
  /className="gantry-toolbar-btn secondary"[\s\S]*?>[\s\S]*?Edit items/,
  'Edit items uses gantry-toolbar-btn secondary',
)

mustMatch(
  navManager,
  /className="gantry-toolbar-btn secondary"[\s\S]*?>[\s\S]*?Rename/,
  'Rename uses gantry-toolbar-btn secondary',
)

mustMatch(
  navManager,
  /className="gantry-toolbar-btn secondary"[\s\S]*?>[\s\S]*?Duplicate/,
  'Duplicate idle control uses gantry-toolbar-btn secondary',
)

// Bare secondary-only action buttons on the list would regress to thin chips.
mustMatch(
  navManager,
  /gantry-toolbar-btn secondary/,
  'nav menus manager keeps gantry-toolbar-btn secondary',
)

const bareSecondaryButtons = readFileSync(resolve(root, navManager), 'utf8').match(
  /className="secondary"/g,
)
if (bareSecondaryButtons?.length) {
  console.error(
    `[fail] nav-menus-manager still has bare className="secondary" (${bareSecondaryButtons.length}) — use gantry-toolbar-btn secondary`,
  )
  process.exit(1)
}
console.log('[ok] no bare secondary action buttons on Navigation list')

mustInclude(
  chrome,
  [
    ':not(.gantry-toolbar-btn)',
    '.outlines-actions > a.gantry-toolbar-btn',
    '.outlines-actions > button.gantry-toolbar-btn',
    'a.gantry-toolbar-btn.secondary',
    'min-height: 2.1rem',
  ],
  'core-chrome keeps outlines-actions Gantry compact sizing + link exclusions',
)

console.log('verify-nav-edit-items-button: pass')
