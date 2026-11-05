import { CORE_ADMIN_BASE, PAYLOAD_ADMIN_BASE } from '@/core/admin-paths'
import { adminNavContributions } from '@/generated/module-registry'

import { CMS_NAV_LINKS, filterCmsNavLinks, type CmsVisibility } from './cms'
import type {
  AdminCmsNavLink,
  AdminNavFeatureFlags,
  AdminNavGroup,
  AdminNavSurface,
} from './types'

const CORE = CORE_ADMIN_BASE
const CMS = PAYLOAD_ADMIN_BASE

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
      id: 'dashboard',
      label: 'Dashboard',
      // Canonical Core landing — logo + first nav leaf both point here (not Users).
      href: CORE,
      links: [{ href: CORE, label: 'Dashboard', exact: true }],
    },
    {
      id: 'site-chrome',
      label: 'Chrome',
      href: `${CORE}/site-chrome`,
      // Always accordion — Environment must stay a visible child (Core + Payload).
      expandable: true,
      // Keep Environment visible without hunting the caret on other admin pages.
      defaultOpen: true,
      links: [
        { href: `${CORE}/site-chrome`, label: 'Chrome', exact: true },
        // #55 gated Environment editor (must stay in shared nav — Core + Payload)
        { href: `${CORE}/site-chrome/environment`, label: 'Environment' },
      ],
    },
    {
      id: 'localization',
      label: 'Localization',
      links: [{ href: `${CORE}/localization`, label: 'Localization' }],
    },
    {
      id: 'site-settings',
      label: 'Settings',
      href: `${CORE}/settings`,
      expandable: true,
      links: [
        { href: `${CORE}/settings`, label: 'Modules', exact: true },
        { href: `${CORE}/settings/admin-ux`, label: 'Admin UX' },
        { href: `${CORE}/settings/auth`, label: 'Auth & registration' },
        { href: `${CORE}/settings/security`, label: 'Security' },
        { href: `${CORE}/settings/performance`, label: 'Performance' },
      ],
    },
  ]

  if (flags.nav) {
    groups.push({
      id: 'navigation',
      label: 'Navigation',
      links: [{ href: `${CORE}/nav`, label: 'Navigation' }],
    })
  }

  // Manifest-contributed packs (Forms, Email, Redirects, Media, …).
  // Keep historical order: Forms → Email → Redirects → Users → Media → Layouts.
  const contributed = buildContributedAdminNavGroups(options.enabledModuleIds)
  const earlyIds = new Set(['forms', 'email', 'redirects'])
  const earlyRank: Record<string, number> = { forms: 0, email: 1, redirects: 2 }
  const early = contributed
    .filter((g) => earlyIds.has(g.id))
    .sort((a, b) => (earlyRank[a.id] ?? 99) - (earlyRank[b.id] ?? 99))
  const late = contributed.filter((g) => !earlyIds.has(g.id))
  groups.push(...early)

  groups.push({
    id: 'users',
    label: 'Users',
    href: `${CORE}/users`,
    expandable: true,
    links: [
      { href: `${CORE}/users`, label: 'Accounts', exact: true },
      { href: `${CORE}/users/groups`, label: 'Groups' },
      { href: `${CORE}/users/acl`, label: 'ACL' },
    ],
  })

  groups.push(...late)

  const showLayouts = flags.layout || flags.pageSettings
  if (showLayouts) {
    const layoutLinks: AdminNavGroup['links'] = []
    if (flags.layout) {
      layoutLinks.push(
        { href: `${CORE}/layouts`, label: 'Layout' },
        { href: `${CORE}/breakpoints`, label: 'Styles' },
        { href: `${CORE}/particle-defaults`, label: 'Particle Defaults' },
        { href: `${CORE}/outlines`, label: 'Outlines' },
      )
    }
    if (flags.pageSettings) {
      // FA config is a Page settings panel (id=font-awesome), not its own left-nav leaf.
      layoutLinks.push({ href: `${CORE}/page-settings`, label: 'Page settings' })
    }
    groups.push({
      id: 'layouts',
      label: 'Layouts',
      href: flags.layout ? `${CORE}/layouts` : `${CORE}/page-settings`,
      expandable: true,
      links: layoutLinks,
    })
  }

  if (flags.cms && cmsLinks.length > 0) {
    groups.push({
      id: 'cms',
      label: 'CMS',
      href: CMS,
      expandable: true,
      links: cmsLinks.map((link) => ({
        href: link.href,
        label: link.label,
        exact: link.exact,
        // From Core, CMS destinations leave the Core shell; from Payload they are local.
        external:
          surface === 'core' ? true : link.external && !link.href.startsWith(CMS),
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
