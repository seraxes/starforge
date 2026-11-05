/**
 * Smoke check: Core + Payload admin sidebar compact brand / avatar header.
 * Run: npx tsx scripts/verify-admin-sidebar-header.mts
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

const layout = readFileSync(
  join(root, 'src/app/(frontend)/admin/layout.tsx'),
  'utf8',
)
const payloadNav = readFileSync(
  join(root, 'src/components/payload/StarforgeAdminNav.tsx'),
  'utf8',
)
const brand = readFileSync(
  join(root, 'src/components/admin/AdminSidebarBrand.tsx'),
  'utf8',
)
const account = readFileSync(
  join(root, 'src/components/admin/AdminSidebarAccount.tsx'),
  'utf8',
)
const chrome = readFileSync(
  join(root, 'src/components/admin/admin-sidebar-chrome.ts'),
  'utf8',
)
const styles = readFileSync(join(root, 'src/app/(frontend)/styles.css'), 'utf8')
const coreChrome = readFileSync(
  join(root, 'src/core/admin-theme/themes/starforge-gantry/core-chrome.css'),
  'utf8',
)
const payloadChrome = readFileSync(
  join(root, 'src/core/admin-theme/themes/starforge-gantry/payload-chrome.css'),
  'utf8',
)

mustInclude(layout, 'Core brand component', 'AdminSidebarBrand')
mustInclude(layout, 'Core account component', 'AdminSidebarAccount')
mustNotInclude(layout, 'Core content header h1', '<h1>Starforge admin</h1>')
mustNotInclude(layout, 'Core signed-in copy', 'Signed in as')
mustNotInclude(layout, 'Core admin-header shell', 'className="admin-header"')

mustInclude(payloadNav, 'Payload brand component', 'AdminSidebarBrand')
mustInclude(payloadNav, 'Payload account component', 'AdminSidebarAccount')
mustNotInclude(payloadNav, 'Payload signed-in copy', 'Signed in as')
mustNotInclude(payloadNav, 'Payload sidebar title copy', 'admin-sidebar-title')

mustInclude(brand, 'STARFORGE logo text', 'STARFORGE')
mustInclude(brand, 'Admin kicker', 'admin-sidebar-kicker')
mustInclude(brand, 'Admin kicker label', 'Admin')
mustInclude(brand, 'logo tooltip const', 'ADMIN_SHELL_LOGO_TOOLTIP')
mustInclude(brand, 'logo title attr', 'title={ADMIN_SHELL_LOGO_TOOLTIP}')
mustInclude(brand, 'logo dashboard href const', 'ADMIN_DASHBOARD_HREF')
mustInclude(brand, 'payload dashboard href const', 'PAYLOAD_DASHBOARD_HREF')
mustInclude(brand, 'logo href attr', 'href={href}')
mustInclude(brand, 'surface prop', 'surface?:')
mustNotInclude(brand, 'logo public-site href', 'href="/"')

mustInclude(account, 'account settings href', 'ADMIN_ACCOUNT_HREF')
mustInclude(account, 'avatar class', 'admin-sidebar-avatar')
mustInclude(chrome, 'dashboard route', "ADMIN_DASHBOARD_HREF = '/admin'")
mustInclude(chrome, 'payload dashboard route', "PAYLOAD_DASHBOARD_HREF = '/cms/admin'")
mustInclude(chrome, 'account route', "/account/security")
mustInclude(chrome, 'tooltip starts with Starforge admin', "'Starforge admin —")
mustInclude(chrome, 'tooltip names Dashboard home', 'Dashboard (/admin)')
mustInclude(payloadNav, 'Payload brand surface', 'surface="payload"')

mustInclude(styles, 'kicker style', '.admin-sidebar-kicker')
mustInclude(styles, 'account style', '.admin-sidebar-account')
mustInclude(styles, 'avatar style', '.admin-sidebar-avatar')
mustInclude(coreChrome, 'dark kicker', '.admin-shell .admin-sidebar-kicker')
mustInclude(coreChrome, 'dark avatar', '.admin-shell .admin-sidebar-avatar')
mustInclude(payloadChrome, 'payload kicker', '.nav .admin-sidebar-kicker')
mustInclude(payloadChrome, 'payload avatar', '.nav .admin-sidebar-avatar')

console.log(
  'ok — admin sidebar compact STARFORGE → /admin (Core) / /cms/admin (Payload) + avatar → /account/security',
)
