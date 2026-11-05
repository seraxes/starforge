/**
 * Smoke check: Core + Payload admin sidebar chrome —
 * white nav text, no stuck blue current/active fill, orange STARFORGE wordmark.
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
mustInclude(styles, 'base wordmark orange hex', 'color: #f2a66a')
mustInclude(coreChrome, 'core wordmark size', 'font-size: 1.38rem')
mustInclude(coreChrome, 'core wordmark forced orange', 'color: #f2a66a !important')
mustInclude(payloadChrome, 'payload wordmark size', 'font-size: 1.38em')
mustInclude(payloadChrome, 'payload wordmark forced orange', 'color: #f2a66a !important')

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

/* —— No stuck blue on current/active (hover may still use mid-blue) —— */
for (const [label, css] of [
  ['styles', styles],
  ['core-chrome', coreChrome],
  ['payload-chrome', payloadChrome],
] as const) {
  mustNotMatch(
    css,
    `${label} combined hover+current blue fill`,
    /\.admin-sidebar-link\.is-current[\s\S]{0,220}background:\s*(?:#3498db|var\(--sf-admin-blue-mid\))(?!\s*,)/,
  )
  mustInclude(css, `${label} current transparent`, 'background: transparent')
}

mustInclude(coreChrome, 'core current transparent important', 'background: transparent !important')
mustInclude(
  payloadChrome,
  'payload current transparent important',
  'background: transparent !important',
)
mustInclude(styles, 'styles hover blue retained', 'background: #3498db')
mustInclude(
  coreChrome,
  'core hover blue retained',
  'background: var(--sf-admin-blue-mid',
)
mustInclude(
  payloadChrome,
  'payload hover blue retained',
  'background: var(--sf-admin-blue-mid)',
)

console.log(
  'ok — sidebar chrome: forced #f2a66a STARFORGE, #fff Admin/nav, content-link tint excludes rail, no stuck blue',
)
