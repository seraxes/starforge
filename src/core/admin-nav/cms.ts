import type { AdminCmsNavLink } from './types'

const PAYLOAD_ADMIN = '/admin'

/**
 * Canonical CMS accordion children — Payload destinations (dashboard + collections + globals).
 * Both Core and Payload sidebars render this list under **CMS**.
 */
export const CMS_NAV_LINKS: AdminCmsNavLink[] = [
  {
    href: PAYLOAD_ADMIN,
    label: 'Dashboard',
    exact: true,
    entity: 'dashboard',
    external: true,
  },
  {
    href: `${PAYLOAD_ADMIN}/collections/pages`,
    label: 'Pages',
    entity: 'collection',
    slug: 'pages',
    external: true,
  },
  {
    href: `${PAYLOAD_ADMIN}/collections/media`,
    label: 'Media',
    entity: 'collection',
    slug: 'media',
    external: true,
  },
  {
    href: `${PAYLOAD_ADMIN}/collections/users`,
    label: 'Users',
    entity: 'collection',
    slug: 'users',
    external: true,
  },
  {
    href: `${PAYLOAD_ADMIN}/globals/site-settings`,
    label: 'Site settings',
    entity: 'global',
    slug: 'site-settings',
    external: true,
  },
]

export type CmsVisibility = {
  collections?: string[]
  globals?: string[]
}

/**
 * Filter CMS links by Payload visibleEntities when known (Payload Nav).
 * Core admin typically passes no filter → full catalog when CMS is enabled.
 */
export function filterCmsNavLinks(
  links: AdminCmsNavLink[],
  visibility?: CmsVisibility | null,
): AdminCmsNavLink[] {
  if (!visibility) return links
  const collections = new Set(visibility.collections ?? [])
  const globals = new Set(visibility.globals ?? [])
  return links.filter((link) => {
    if (link.entity === 'dashboard') return true
    if (link.entity === 'collection' && link.slug) return collections.has(link.slug)
    if (link.entity === 'global' && link.slug) return globals.has(link.slug)
    return true
  })
}
