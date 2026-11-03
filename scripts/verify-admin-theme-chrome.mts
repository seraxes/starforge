/**
 * Smoke check: Core admin theme chrome — Layout module tokens + Page Settings panel language.
 * Run: npx tsx scripts/verify-admin-theme-chrome.mts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const chromePath = join(
  root,
  'src/core/admin-theme/themes/starforge-gantry/core-chrome.css',
)
const stylesPath = join(root, 'src/app/(frontend)/styles.css')
const chrome = readFileSync(chromePath, 'utf8')
const styles = readFileSync(stylesPath, 'utf8')

function mustInclude(haystack: string, label: string, needle: string) {
  if (!haystack.includes(needle)) {
    console.error(`missing ${label}: ${needle}`)
    process.exit(1)
  }
}

mustInclude(chrome, 'module border width token', '--sf-admin-module-border-width: 4px')
mustInclude(chrome, 'module border color token', '--sf-admin-module-border-color: #0f3d63')
mustInclude(chrome, 'primary icon bump', '--sf-admin-icon-primary: 2rem')
mustInclude(chrome, 'secondary icon size', '--sf-admin-icon-secondary: 1.75rem')
mustInclude(chrome, 'btn min height', '--sf-admin-btn-min-height: 2.35rem')
mustInclude(chrome, 'btn pad y', '--sf-admin-btn-pad-y: 0.5rem')
mustInclude(chrome, 'btn pad x', '--sf-admin-btn-pad-x: 1rem')
mustInclude(chrome, 'btn font', '--sf-admin-btn-font: 0.9rem')

mustInclude(chrome, 'panel token', '--sf-admin-panel: #1b2432')
mustInclude(chrome, 'panel head token', '--sf-admin-panel-head: #121a24')
mustInclude(chrome, 'panel border token', '--sf-admin-panel-border: #2f3d50')

mustInclude(
  chrome,
  'palette uses module border width',
  'border: var(--sf-admin-module-border-width) solid var(--sf-admin-module-border-color)',
)
mustInclude(chrome, 'form drop-empty chrome', '.admin-shell .gantry-drop-empty')
mustInclude(chrome, 'settings fieldset panel head', '.admin-shell .settings-fieldset > legend')
mustInclude(chrome, 'page-settings panel uses panel token', 'background: var(--sf-admin-panel)')

mustInclude(styles, 'shared settings mosaic', '.admin-settings-mosaic')
mustInclude(styles, 'mosaic two columns', 'grid-template-columns: repeat(2, minmax(0, 1fr))')
mustInclude(styles, 'mosaic mobile single column', '@media (max-width: 720px)')

if (styles.includes('grid-template-columns: repeat(3, minmax(0, 1fr))')) {
  console.error('page-settings mosaic must stay 2-col desktop (no 3-col breakpoint)')
  process.exit(1)
}

const barRemoveBlock = chrome.slice(
  chrome.indexOf('/* Muted danger remove beside cog'),
  chrome.indexOf('.admin-shell .gantry-slot-extra-actions'),
)
if (!barRemoveBlock.includes('border: 0')) {
  console.error('gantry-bar-remove must be borderless (no blue outline box)')
  process.exit(1)
}
if (barRemoveBlock.includes('border: 1px')) {
  console.error('gantry-bar-remove must not keep a 1px border box')
  process.exit(1)
}

console.log(
  'ok — admin theme chrome (Layout module edge + Page Settings panel mosaic 2-col)',
)
