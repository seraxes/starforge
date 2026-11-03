/**
 * Smoke check: Core + Payload admin theme chrome — Layout module tokens +
 * Page Settings panel language shared across shells.
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
const payloadChromePath = join(
  root,
  'src/core/admin-theme/themes/starforge-gantry/payload-chrome.css',
)
const tokensPath = join(
  root,
  'src/core/admin-theme/themes/starforge-gantry/tokens.ts',
)
const stylesPath = join(root, 'src/app/(frontend)/styles.css')
const mediaLibraryPath = join(
  root,
  'src/app/(frontend)/app/admin/media/media-library.tsx',
)
const mediaLightboxPath = join(root, 'src/components/admin/MediaLightbox.tsx')
const chrome = readFileSync(chromePath, 'utf8')
const payloadChrome = readFileSync(payloadChromePath, 'utf8')
const tokens = readFileSync(tokensPath, 'utf8')
const styles = readFileSync(stylesPath, 'utf8')
const mediaLibrary = readFileSync(mediaLibraryPath, 'utf8')
const mediaLightbox = readFileSync(mediaLightboxPath, 'utf8')

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
mustInclude(chrome, 'media folder sidebar layout', '.admin-shell .sf-media-library-layout')
mustInclude(chrome, 'media folder nav', '.admin-shell .sf-media-folder-nav')
mustInclude(chrome, 'media folder item', '.admin-shell .sf-media-folder-item')
mustInclude(chrome, 'media lightbox dialog', '.admin-shell .sf-media-lightbox-dialog')
mustInclude(chrome, 'media lightbox preview', '.admin-shell .sf-media-lightbox-preview')
mustInclude(chrome, 'media library empty state', '.admin-shell .sf-media-library-empty')
mustInclude(chrome, 'media chip', '.admin-shell .sf-media-chip')
mustInclude(mediaLibrary, 'library opens MediaLightbox', 'MediaLightbox')
mustInclude(mediaLibrary, 'library folder sidebar', 'sf-media-folder-nav')
mustInclude(mediaLightbox, 'lightbox Esc handler', "event.key === 'Escape'")
mustInclude(mediaLightbox, 'lightbox prev arrow', "event.key === 'ArrowLeft'")
mustInclude(mediaLightbox, 'lightbox next arrow', "event.key === 'ArrowRight'")
mustInclude(mediaLightbox, 'lightbox Close label', 'aria-label="Close"')

mustInclude(
  chrome,
  'media picker dialog panel border',
  '.admin-shell .sf-media-picker-dialog',
)
{
  const dialogBlock = chrome.slice(
    chrome.indexOf('.admin-shell .sf-media-picker-dialog {'),
    chrome.indexOf('.admin-shell .sf-media-picker-dialog-head {'),
  )
  if (dialogBlock.includes('--sf-admin-module-border-width')) {
    console.error('sf-media-picker-dialog must use panel border, not Layout module edge')
    process.exit(1)
  }
  if (!dialogBlock.includes('var(--sf-admin-panel-border)')) {
    console.error('sf-media-picker-dialog missing panel border token')
    process.exit(1)
  }
}

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

mustInclude(payloadChrome, 'payload panel token', '--sf-admin-panel: #1b2432')
mustInclude(payloadChrome, 'payload panel head token', '--sf-admin-panel-head: #121a24')
mustInclude(
  payloadChrome,
  'payload panel border token',
  '--sf-admin-panel-border: #2f3d50',
)
mustInclude(payloadChrome, 'payload btn min height', '--sf-admin-btn-min-height: 2.35rem')
mustInclude(payloadChrome, 'payload nav-bar token', '--sf-admin-nav-bar: #1b2431')
mustInclude(
  payloadChrome,
  'payload theme border uses panel border',
  '--theme-border-color: var(--sf-admin-panel-border)',
)
mustInclude(
  payloadChrome,
  'payload elevation-50 uses panel',
  '--theme-elevation-50: var(--sf-admin-panel)',
)
mustInclude(payloadChrome, 'payload card panel chrome', 'html[data-theme=\'dark\'] .card')
mustInclude(
  payloadChrome,
  'payload primary remains orange',
  '--bg-color: var(--sf-primary)',
)

mustInclude(tokens, 'tokens panel', "panel: '#1b2432'")
mustInclude(tokens, 'tokens panelHead', "panelHead: '#121a24'")
mustInclude(tokens, 'tokens panelBorder', "panelBorder: '#2f3d50'")

console.log(
  'ok — admin theme chrome (Core Layout/Page Settings + Payload panel align)',
)
