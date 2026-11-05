/**
 * Lock: Core admin root `/admin` is Dashboard — never redirect-land on Users.
 * Run: npx tsx scripts/verify-admin-root-dashboard.mts
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { firstAdminLandingPath } from '../src/core/acl/decide.ts'
import { buildAdminNavGroups } from '../src/core/admin-nav/build.ts'
import { CORE_ADMIN_BASE } from '../src/core/admin-paths.ts'
import { ADMIN_DASHBOARD_HREF } from '../src/components/admin/admin-sidebar-chrome.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function must(cond: unknown, message: string): asserts cond {
  if (!cond) {
    console.error(message)
    process.exit(1)
  }
}

const page = readFileSync(join(root, 'src/app/(frontend)/admin/page.tsx'), 'utf8')
must(!/\bredirect\s*\(/.test(page), 'admin/page.tsx must not redirect — render Dashboard in place')
must(
  !/redirect\s*\(\s*['"`][^'"`]*\/admin\/users/.test(page),
  'admin/page.tsx must not redirect to /admin/users',
)
must(
  page.includes('CoreAdminDashboardPage') || page.includes('Dashboard'),
  'admin/page.tsx must be the Dashboard host',
)
must(page.includes("title: 'Dashboard"), 'admin/page.tsx metadata title must be Dashboard')

const layout = readFileSync(join(root, 'src/app/(frontend)/admin/layout.tsx'), 'utf8')
must(
  layout.includes("redirect('/login?next=/admin')"),
  'admin layout login next must be /admin (not /admin/users)',
)
must(
  !layout.includes("next=/admin/users"),
  'admin layout must not send login next to /admin/users',
)

must(ADMIN_DASHBOARD_HREF === '/admin', `ADMIN_DASHBOARD_HREF must be /admin, got ${ADMIN_DASHBOARD_HREF}`)
must(CORE_ADMIN_BASE === '/admin', `CORE_ADMIN_BASE must be /admin, got ${CORE_ADMIN_BASE}`)

must(
  firstAdminLandingPath({ isAppAdmin: true, allowed: new Set() }) === '/admin',
  'app admins must land on /admin (Dashboard), not /admin/users',
)
must(
  firstAdminLandingPath({
    isAppAdmin: false,
    allowed: new Set(['admin.dashboard', 'admin.users']),
  }) === '/admin',
  'Managers with admin.dashboard must land on /admin before Users',
)

const groups = buildAdminNavGroups({
  surface: 'core',
  flags: { nav: true, layout: true, pageSettings: true, cms: true },
  enabledModuleIds: new Set([
    'product:forms',
    'product:email-manager',
    'product:redirects',
    'product:media',
  ]),
})
must(groups[0]?.id === 'dashboard', `first nav group must be dashboard, got ${groups[0]?.id}`)
must(groups[0]?.href === '/admin', `dashboard group href must be /admin, got ${groups[0]?.href}`)
must(
  groups[0]?.links[0]?.href === '/admin' && groups[0]?.links[0]?.exact === true,
  'dashboard leaf must be exact /admin',
)
must(
  groups.find((g) => g.id === 'users')?.href === '/admin/users',
  'Users remains a child area — not the admin root',
)

const nextConfig = readFileSync(join(root, 'next.config.ts'), 'utf8')
must(
  !/destination:\s*['"`]\/admin\/users/.test(nextConfig),
  'next.config must not redirect anything to /admin/users as admin home',
)
must(
  nextConfig.includes("destination: '/admin'") && nextConfig.includes("source: '/app/admin'"),
  'legacy /app/admin must redirect to /admin (Dashboard)',
)

console.log('verify-admin-root-dashboard: pass — /admin is Dashboard (Users is not the landing)')
