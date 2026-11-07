/**
 * Smoke check: Core + Payload admin sidebar chrome —
 * white nav text, hover mid-blue / active darker blue, orange STARFORGE wordmark.
 * Guards the content-link tint specificity trap in core-chrome.css.
 * Run: npx tsx scripts/verify-admin-sidebar-text-colors.mts
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

function mustNotMatch(haystack: string, label: string, pattern: RegExp) {
  if (pattern.test(haystack)) {
    console.error(`unexpected ${label}: ${pattern}`)
    process.exit(1)
  }
}

const styles = readFileSync(join(root, 'src/app/(frontend)/styles.css'), 'utf8')
const coreChrome = readFileSync(
  join(root, 'src/core/admin-theme/themes/starforge-gantry/core-chrome.css'),
  'utf8',
)
const payloadChrome = readFileSync(
  join(root, 'src/core/admin-theme/themes/starforge-gantry/payload-chrome.css'),
  'utf8',
)

/* —— Wordmark: ~50% larger + forced brand orange —— */
mustInclude(styles, 'base wordmark size', 'font-size: 1.38rem')
mustInclude(styles, 'base wordmark orange hex', 'color: #ef9550')
mustInclude(coreChrome, 'core wordmark size', 'font-size: 1.38rem')
mustInclude(coreChrome, 'core wordmark forced orange', 'color: #ef9550 !important')
mustInclude(payloadChrome, 'payload wordmark size', 'font-size: 1.38em')
mustInclude(payloadChrome, 'payload wordmark forced orange', 'color: #ef9550 !important')

/* —— Admin kicker: larger + white —— */
mustInclude(styles, 'base kicker size', 'font-size: 1.05rem')
mustInclude(coreChrome, 'core kicker size', 'font-size: 1.05rem')
mustInclude(payloadChrome, 'payload kicker size', 'font-size: 1.05em')
mustInclude(coreChrome, 'core kicker forced white', '.admin-sidebar-kicker')
mustInclude(coreChrome, 'core force white important', 'color: #fff !important')

/* —— Content-link tint must exclude sidebar anchors —— */
mustInclude(
  coreChrome,
  'content-link tint excludes sidebar logo',
  ':not(.admin-sidebar-logo)',
)
mustInclude(
  coreChrome,
  'content-link tint excludes sidebar link',
  ':not(.admin-sidebar-link)',
)
mustInclude(
  coreChrome,
  'content-link tint excludes sidebar sublink',
  ':not(.admin-sidebar-sublink)',
)
mustInclude(
  coreChrome,
  'content-link tint excludes sidebar account',
  ':not(.admin-sidebar-account)',
)

/* —— Hover mid-blue; active leaf darker blue (not #3498db, not transparent) —— */
mustInclude(styles, 'styles hover blue', 'background: #3498db')
mustInclude(styles, 'styles active darker blue', 'background: #2471a3')
mustInclude(coreChrome, 'core blue-active token', '--sf-admin-blue-active: #2471a3')
mustInclude(coreChrome, 'core hover mid', 'background: var(--sf-admin-blue-mid')
mustInclude(coreChrome, 'core active darker', 'background: var(--sf-admin-blue-active')
mustInclude(payloadChrome, 'payload blue-active token', '--sf-admin-blue-active: #2471a3')
mustInclude(payloadChrome, 'payload hover mid', 'background: var(--sf-admin-blue-mid)')
mustInclude(payloadChrome, 'payload active darker', 'background: var(--sf-admin-blue-active)')

for (const [label, css] of [
  ['styles', styles],
  ['core-chrome', coreChrome],
  ['payload-chrome', payloadChrome],
] as const) {
  /* Active must not reuse the hover mid-blue fill */
  mustNotMatch(
    css,
    `${label} active leaf same as hover mid-blue`,
    /\.admin-sidebar-link\.is-current[\s\S]{0,220}background:\s*(?:#3498db|var\(--sf-admin-blue-mid\))(?!\s*,)/,
  )
  /* No sticky fill on accordion group-heads via .is-active */
  mustNotMatch(
    css,
    `${label} group-head sticky is-active fill`,
    /\.admin-sidebar-item\.is-active\s*>\s*\.admin-sidebar-group-head[\s\S]{0,120}background:\s*(?!transparent)/,
  )
}

/* Current leaf rules must not paint transparent again */
mustNotMatch(
  coreChrome,
  'core current transparent !important',
  /\.admin-sidebar-link\.is-current[\s\S]{0,200}background:\s*transparent\s*!important/,
)
mustNotMatch(
  payloadChrome,
  'payload current transparent !important',
  /\.admin-sidebar-link\.is-current[\s\S]{0,200}background:\s*transparent\s*!important/,
)

mustInclude(payloadChrome, 'payload nav width matches Core px', '--nav-width: 273px')
mustInclude(payloadChrome, 'payload primary orange', '--sf-primary: #ef9550')
mustInclude(payloadChrome, 'payload primary ink white', '--sf-primary-ink: #ffffff')
mustInclude(payloadChrome, 'payload thin scrollbar', 'scrollbar-width: thin')
mustInclude(
  payloadChrome,
  'payload nav padding via scroll vars not wrap',
  '--nav-padding-block-start: 18px',
)
mustInclude(payloadChrome, 'payload wrap padding zero', 'padding: 0')
mustInclude(payloadChrome, 'payload wrap stretch items', 'align-items: stretch')

console.log(
  'ok — sidebar chrome: forced #ef9550 STARFORGE, #fff Admin/nav, hover #3498db, active #2471a3 leaf-only',
)
