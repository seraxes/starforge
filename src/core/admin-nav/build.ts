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

/** Content-band contribution — placed after Layouts/CMS, not with product packs. */
const CONTENT_BAND_IDS = new Set(['media'])

/**
 * Contributions merged into the Core Users accordion (not top-level product packs).
 * Profiles settings belong with Accounts / Groups / ACL.
 */
const USERS_ATTACHED_IDS = new Set(['profiles'])

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
  /** Settings → Audit. Omitted for members and app admins who are not developer-admins. */
  developerAdmin?: boolean
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
 * Structure band — single Skins accordion:
 *   Skins (title → /admin/skins)
 *   - Outline (→ /admin/outlines) — list/create outlines for the active skin
 *     -- Layout / Styles / Page settings / Assigned Menu
 */
function buildLayoutsBand(flags: AdminNavFeatureFlags): AdminNavGroup[] {
  const showBand = flags.layout || flags.pageSettings
  if (!showBand) return []

  const links: AdminNavGroup['links'] = []

  if (flags.layout) {
    const outlineChildren: AdminNavGroup['links'] = [
      { href: `${CORE}/layouts`, label: 'Layout' },
      { href: `${CORE}/breakpoints`, label: 'Styles' },
    ]
    if (flags.pageSettings) {
      // FA config is a Page settings panel (id=font-awesome), not its own left-nav leaf.
      outlineChildren.push({ href: `${CORE}/page-settings`, label: 'Page settings' })
    }
    outlineChildren.push({ href: `${CORE}/assigned-menu`, label: 'Assigned Menu' })
    links.push({
      href: `${CORE}/outlines`,
      label: 'Outline',
      children: outlineChildren,
    })
  } else if (flags.pageSettings) {
    links.push({ href: `${CORE}/page-settings`, label: 'Page settings' })
  }

  return [
    {
      id: 'skins',
      label: 'Skins',
      href: `${CORE}/skins`,
      expandable: true,
      links,
    },
  ]
}

function buildCmsGroup(
  surface: AdminNavSurface,
  cmsLinks: AdminCmsNavLink[],
): AdminNavGroup | null {
  if (cmsLinks.length === 0) return null
  return {
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
  }
}

/**
 * One seamless admin tree for Core + Payload.
 * Bands: home → site shell → Skins (Outline nest) → product modules → access/platform.
 * CMS accordion children are Payload destinations; other leaves stay on Core routes.
 * Product packs (Forms / Redirects / Media / …) contribute via manifest admin.nav (M2).
 */
export function buildAdminNavGroups(options: BuildAdminNavOptions): AdminNavGroup[] {
  const { flags, surface, cmsVisibility } = options
  const cmsLinks =
    options.cmsLinks ?? filterCmsNavLinks(CMS_NAV_LINKS, cmsVisibility ?? null)

  const contributed = buildContributedAdminNavGroups(options.enabledModuleIds)
  const mediaGroup = contributed.find((g) => CONTENT_BAND_IDS.has(g.id)) ?? null
  const profilesGroup =
    contributed.find((g) => USERS_ATTACHED_IDS.has(g.id)) ?? null
  const productGroups = contributed.filter(
    (g) => !CONTENT_BAND_IDS.has(g.id) && !USERS_ATTACHED_IDS.has(g.id),
  )

  const groups: AdminNavGroup[] = [
    // —— Home ——
    {
      id: 'dashboard',
      label: 'Dashboard',
      // Canonical Core landing — logo + first nav leaf both point here (not Users).
      href: CORE,
      links: [{ href: CORE, label: 'Dashboard', exact: true }],
    },
    // —— Site shell ——
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
  ]

  if (flags.nav) {
    groups.push({
      id: 'navigation',
      label: 'Navigation',
      links: [{ href: `${CORE}/nav`, label: 'Navigation' }],
    })
  }

  // —— Structure & content ——
  groups.push(...buildLayoutsBand(flags))

  if (flags.cms) {
    const cms = buildCmsGroup(surface, cmsLinks)
    if (cms) groups.push(cms)
  }

  if (mediaGroup) groups.push(mediaGroup)

  // —— Product modules (manifest order) ——
  groups.push(...productGroups)

  // —— Access & platform ——
  const userLinks: AdminNavGroup['links'] = [
    { href: `${CORE}/users`, label: 'Accounts', exact: true },
    { href: `${CORE}/users/groups`, label: 'Groups' },
    { href: `${CORE}/users/acl`, label: 'ACL' },
  ]
  if (profilesGroup) {
    for (const link of profilesGroup.links) {
      userLinks.push({
        href: link.href,
        label: link.label === 'Settings' ? 'Profile settings' : link.label,
        ...(link.exact ? { exact: true as const } : {}),
        ...(link.external ? { external: true as const } : {}),
      })
    }
  }
  groups.push({
    id: 'users',
    label: 'Users',
    href: `${CORE}/users`,
    expandable: true,
    links: userLinks,
  })

  const settingsLinks: AdminNavGroup['links'] = [
    { href: `${CORE}/settings`, label: 'Modules', exact: true },
    { href: `${CORE}/settings/admin-ux`, label: 'Admin UX' },
    { href: `${CORE}/settings/auth`, label: 'Auth & registration' },
    { href: `${CORE}/settings/security`, label: 'Security' },
    { href: `${CORE}/settings/performance`, label: 'Performance' },
  ]
  if (options.developerAdmin) {
    settingsLinks.push({ href: `${CORE}/audit`, label: 'Audit' })
  }

  groups.push({
    id: 'site-settings',
    label: 'Settings',
    href: `${CORE}/settings`,
    expandable: true,
    links: settingsLinks,
  })

  // Check site lives beside the STARFORGE logo (AdminSidebarBrand), not in the nav list.

  return groups
}
