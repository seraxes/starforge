/**
 * Smoke check: Core admin theme chrome tokens for the Layout-aligned rehaul.
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
const css = readFileSync(chromePath, 'utf8')

function mustInclude(label: string, needle: string) {
  if (!css.includes(needle)) {
    console.error(`missing ${label}: ${needle}`)
    process.exit(1)
  }
}

mustInclude('module border width token', '--sf-admin-module-border-width: 4px')
mustInclude('module border color token', '--sf-admin-module-border-color: #0f3d63')
mustInclude('primary icon bump', '--sf-admin-icon-primary: 2rem')
mustInclude('secondary icon size', '--sf-admin-icon-secondary: 1.75rem')
mustInclude('btn min height', '--sf-admin-btn-min-height: 2.35rem')
mustInclude('btn pad y', '--sf-admin-btn-pad-y: 0.5rem')
mustInclude('btn pad x', '--sf-admin-btn-pad-x: 1rem')
mustInclude('btn font', '--sf-admin-btn-font: 0.9rem')

mustInclude(
  'palette uses module border width',
  'border: var(--sf-admin-module-border-width) solid var(--sf-admin-module-border-color)',
)
mustInclude('form drop-empty chrome', '.admin-shell .gantry-drop-empty')

const barRemoveBlock = css.slice(
  css.indexOf('/* Muted danger remove beside cog'),
  css.indexOf('.admin-shell .gantry-slot-extra-actions'),
)
if (!barRemoveBlock.includes('border: 0')) {
  console.error('gantry-bar-remove must be borderless (no blue outline box)')
  process.exit(1)
}
if (barRemoveBlock.includes('border: 1px')) {
  console.error('gantry-bar-remove must not keep a 1px border box')
  process.exit(1)
}

console.log('ok — admin theme chrome tokens (4px module edge, icons, buttons, borderless X)')
