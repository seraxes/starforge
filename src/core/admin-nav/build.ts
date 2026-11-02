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
}

/**
 * One seamless admin tree for Core + Payload.
 * CMS accordion children are Payload destinations; other leaves stay on Core routes.
 */
export function buildAdminNavGroups(options: BuildAdminNavOptions): AdminNavGroup[] {
  const { flags, surface, cmsVisibility } = options
  const cmsLinks =
    options.cmsLinks ?? filterCmsNavLinks(CMS_NAV_LINKS, cmsVisibility ?? null)

  const groups: AdminNavGroup[] = [
    {
      id: 'site-chrome',
      label: 'Site Chrome',
      href: '/app/admin/site-chrome',
      // Always accordion — Environment must stay a visible child (Core + Payload).
      expandable: true,
      // Keep Environment visible without hunting the caret on other admin pages.
      defaultOpen: true,
      links: [
        { href: '/app/admin/site-chrome', label: 'Site Chrome', exact: true },
        // #55 gated Environment editor (must stay in shared nav — Core + Payload)
        { href: '/app/admin/site-chrome/environment', label: 'Environment' },
      ],
    },
    {
      id: 'site-settings',
      label: 'Site Settings',
      href: '/app/admin/settings',
      expandable: true,
      links: [
        { href: '/app/admin/settings', label: 'Modules', exact: true },
        { href: '/app/admin/settings/admin-ux', label: 'Admin UX' },
        { href: '/app/admin/settings/auth', label: 'Auth & registration' },
        { href: '/app/admin/settings/integrations', label: 'Integrations' },
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

  if (flags.forms) {
    groups.push({
      id: 'forms',
      label: 'Forms',
      href: '/app/admin/forms',
      expandable: true,
      links: [
        { href: '/app/admin/forms', label: 'Forms', exact: true },
        { href: '/app/admin/forms/settings', label: 'Settings' },
      ],
    })
  }

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

  // Core media library UI (same Payload store) — always for app admins.
  groups.push({
    id: 'media',
    label: 'Media',
    links: [{ href: '/app/admin/media', label: 'Media' }],
  })

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
      layoutLinks.push(
        { href: '/app/admin/page-settings', label: 'Page settings' },
        // FA config lives under Page settings (Layouts), not Site Settings topics.
        { href: '/app/admin/page-settings#font-awesome', label: 'Font Awesome' },
      )
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
