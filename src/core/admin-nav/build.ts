import { adminNavContributions } from '@/generated/module-registry'

import { CMS_NAV_LINKS, filterCmsNavLinks, type CmsVisibility } from './cms'
import type {
  AdminCmsNavLink,
  AdminNavFeatureFlags,
  AdminNavGroup,
  AdminNavSurface,
} from './types'

export type BuildAdminNavOptions = {
  flags: AdminNavFeatureFlags
  /** Which admin surface is rendering — same tree; marks cross-links. */
  surface: AdminNavSurface
  /** Optional Payload visibility filter for CMS children. */
  cmsVisibility?: CmsVisibility | null
  /** Override CMS children (tests); default = filtered CMS_NAV_LINKS. */
  cmsLinks?: AdminCmsNavLink[]
  /**
   * Module ids whose Site Settings toggle (or required catalog row) is on.
   * Used to filter manifest `admin.nav` contributions (M2).
   * When omitted, all generated contributions are included (tests / legacy).
   */
  enabledModuleIds?: ReadonlySet<string> | readonly string[]
}

function asEnabledSet(
  enabledModuleIds: BuildAdminNavOptions['enabledModuleIds'],
): ReadonlySet<string> | null {
  if (!enabledModuleIds) return null
  return enabledModuleIds instanceof Set ? enabledModuleIds : new Set(enabledModuleIds)
}

/** Build AdminNavGroup[] from generated module admin.nav contributions. */
export function buildContributedAdminNavGroups(
  enabledModuleIds?: BuildAdminNavOptions['enabledModuleIds'],
): AdminNavGroup[] {
  const enabled = asEnabledSet(enabledModuleIds)
  const matched = adminNavContributions
    .filter((entry) => (enabled ? enabled.has(entry.moduleId) : true))
    .slice()
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))

  return matched.map((entry) => {
    const links = entry.links
      .slice()
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      .map((link) => ({
        href: link.href,
        label: link.label,
        ...(link.exact ? { exact: true as const } : {}),
      }))

    const group: AdminNavGroup = {
      id: entry.id,
      label: entry.label,
      links,
    }
    if (entry.href) group.href = entry.href
    if (entry.expandable) group.expandable = true
    if (entry.defaultOpen) group.defaultOpen = true
    return group
  })
}

/**
 * One seamless admin tree for Core + Payload.
 * CMS accordion children are Payload destinations; other leaves stay on Core routes.
 * Product packs (Forms / Redirects / Media / …) contribute via manifest admin.nav (M2).
 */
export function buildAdminNavGroups(options: BuildAdminNavOptions): AdminNavGroup[] {
  const { flags, surface, cmsVisibility } = options
  const cmsLinks =
    options.cmsLinks ?? filterCmsNavLinks(CMS_NAV_LINKS, cmsVisibility ?? null)

  const groups: AdminNavGroup[] = [
    {
      id: 'site-chrome',
      label: 'Chrome',
      href: '/app/admin/site-chrome',
      // Always accordion — Environment must stay a visible child (Core + Payload).
      expandable: true,
      // Keep Environment visible without hunting the caret on other admin pages.
      defaultOpen: true,
      links: [
        { href: '/app/admin/site-chrome', label: 'Chrome', exact: true },
        // #55 gated Environment editor (must stay in shared nav — Core + Payload)
        { href: '/app/admin/site-chrome/environment', label: 'Environment' },
      ],
    },
    {
      id: 'site-settings',
      label: 'Settings',
      href: '/app/admin/settings',
      expandable: true,
      links: [
        { href: '/app/admin/settings', label: 'Modules', exact: true },
        { href: '/app/admin/settings/admin-ux', label: 'Admin UX' },
        { href: '/app/admin/settings/auth', label: 'Auth & registration' },
        { href: '/app/admin/settings/security', label: 'Security' },
        { href: '/app/admin/settings/performance', label: 'Performance' },
      ],
    },
  ]

  if (flags.nav) {
    groups.push({
      id: 'navigation',
      label: 'Navigation',
      links: [{ href: '/app/admin/nav', label: 'Navigation' }],
    })
  }

  // Manifest-contributed packs (Forms, Redirects, Media, …).
  // Keep historical order: Forms → Redirects → Users → Media → Layouts.
  const contributed = buildContributedAdminNavGroups(options.enabledModuleIds)
  const early = contributed.filter((g) => g.id === 'forms' || g.id === 'redirects')
  const late = contributed.filter((g) => g.id !== 'forms' && g.id !== 'redirects')
  groups.push(...early)

  groups.push({
    id: 'users',
    label: 'Users',
    href: '/app/admin/users',
    expandable: true,
    links: [
      { href: '/app/admin/users', label: 'Accounts', exact: true },
      { href: '/app/admin/users/groups', label: 'Groups' },
      { href: '/app/admin/users/acl', label: 'ACL' },
    ],
  })

  groups.push(...late)

  const showLayouts = flags.layout || flags.pageSettings
  if (showLayouts) {
    const layoutLinks: AdminNavGroup['links'] = []
    if (flags.layout) {
      layoutLinks.push(
        { href: '/app/admin/layouts', label: 'Layout' },
        { href: '/app/admin/breakpoints', label: 'Styles' },
        { href: '/app/admin/particle-defaults', label: 'Particle Defaults' },
        { href: '/app/admin/outlines', label: 'Outlines' },
      )
    }
    if (flags.pageSettings) {
      // FA config is a Page settings panel (id=font-awesome), not its own left-nav leaf.
      layoutLinks.push({ href: '/app/admin/page-settings', label: 'Page settings' })
    }
    groups.push({
      id: 'layouts',
      label: 'Layouts',
      href: flags.layout ? '/app/admin/layouts' : '/app/admin/page-settings',
      expandable: true,
      links: layoutLinks,
    })
  }

  if (flags.cms && cmsLinks.length > 0) {
    groups.push({
      id: 'cms',
      label: 'CMS',
      href: '/admin',
      expandable: true,
      links: cmsLinks.map((link) => ({
        href: link.href,
        label: link.label,
        exact: link.exact,
        // From Core, CMS destinations leave the Core shell; from Payload they are local.
        external: surface === 'core' ? true : link.external && !link.href.startsWith('/admin'),
      })),
    })
  }

  groups.push({
    id: 'check-site',
    label: 'Check site',
    links: [{ href: '/', label: 'Check site', exact: true }],
  })

  return groups
}
