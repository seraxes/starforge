/**
 * Smoke check: Core + Payload admin sidebar chrome —
 * white nav text, no stuck blue current/active fill, orange STARFORGE wordmark.
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

/* —— Wordmark: ~50% larger + brand orange —— */
mustInclude(styles, 'base wordmark size', 'font-size: 1.38rem')
mustInclude(styles, 'base wordmark orange', 'color: var(--sf-primary)')
mustInclude(coreChrome, 'core wordmark size', 'font-size: 1.38rem')
mustInclude(coreChrome, 'core wordmark orange', 'color: var(--sf-primary)')
mustInclude(payloadChrome, 'payload wordmark size', 'font-size: 1.38em')
mustInclude(payloadChrome, 'payload wordmark orange', 'var(--sf-primary, #f2a66a)')

/* —— Admin kicker: larger + white —— */
mustInclude(styles, 'base kicker size', 'font-size: 1.05rem')
mustInclude(styles, 'base kicker white', '.admin-sidebar-kicker')
mustInclude(coreChrome, 'core kicker white', '.admin-shell .admin-sidebar-kicker')
mustInclude(coreChrome, 'core kicker size', 'font-size: 1.05rem')
mustInclude(payloadChrome, 'payload kicker size', 'font-size: 1.05em')

const kickerCore = coreChrome.match(
  /\.admin-shell \.admin-sidebar-kicker\s*\{[^}]+\}/,
)
if (!kickerCore || !kickerCore[0].includes('color: #fff')) {
  console.error('missing core kicker white color block')
  process.exit(1)
}
const kickerPayload = payloadChrome.match(
  /\.nav \.admin-sidebar-kicker\s*\{[^}]+\}/,
)
if (!kickerPayload || !kickerPayload[0].includes('color: #fff')) {
  console.error('missing payload kicker white color block')
  process.exit(1)
}

/* —— Nav / sublink / account text white —— */
mustInclude(styles, 'base link white', 'color: #fff')
mustInclude(coreChrome, 'core sublink/link white selectors', '.admin-shell .admin-sidebar-sublink')
mustInclude(coreChrome, 'core account name white', '.admin-shell .admin-sidebar-account-name')
mustInclude(payloadChrome, 'payload account name white', 'color: #fff')

const accountCore = coreChrome.match(
  /\.admin-shell \.admin-sidebar-account-name\s*\{[^}]+\}/,
)
if (!accountCore || !accountCore[0].includes('color: #fff')) {
  console.error('missing core account-name white')
  process.exit(1)
}

/* —— No stuck blue on current/active (hover may still use mid-blue) —— */
for (const [label, css] of [
  ['styles', styles],
  ['core-chrome', coreChrome],
  ['payload-chrome', payloadChrome],
] as const) {
  // Combined hover+current rule that paints blue on is-current must stay gone.
  mustNotMatch(
    css,
    `${label} combined hover+current blue fill`,
    /\.admin-sidebar-link\.is-current[\s\S]{0,220}background:\s*(?:#3498db|var\(--sf-admin-blue-mid\))/,
  )
  mustInclude(css, `${label} current transparent`, 'background: transparent')
}

mustInclude(styles, 'styles hover blue retained', 'background: #3498db')
mustInclude(
  coreChrome,
  'core hover blue retained',
  'background: var(--sf-admin-blue-mid)',
)
mustInclude(
  payloadChrome,
  'payload hover blue retained',
  'background: var(--sf-admin-blue-mid)',
)

console.log(
  'ok — sidebar chrome: orange STARFORGE 1.38, white Admin/nav, no stuck blue current fill',
)
