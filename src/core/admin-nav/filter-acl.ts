import { adminHrefAllowed, type AclAdminResourceKey } from '@/core/acl'

import type { AdminNavGroup, AdminNavLink } from './types'

function filterNavLinkByAcl(
  link: AdminNavLink,
  allowed: ReadonlySet<AclAdminResourceKey>,
): AdminNavLink[] {
  const children = (link.children ?? []).flatMap((child) =>
    filterNavLinkByAcl(child, allowed),
  )
  const selfAllowed = adminHrefAllowed(link.href, false, allowed)
  if (selfAllowed) {
    return [
      children.length > 0 ? { ...link, children } : { ...link, children: undefined },
    ]
  }
  // Parent blocked — promote any allowed nested leaves.
  return children
}

/**
 * Same ACL prune for Core `/admin` and Payload `/cms/admin` sidebars.
 * App admins see the full tree; managers keep only allowed hrefs.
 */
export function filterAdminNavByAcl(
  groups: AdminNavGroup[],
  isAppAdmin: boolean,
  allowed: ReadonlySet<AclAdminResourceKey>,
): AdminNavGroup[] {
  if (isAppAdmin) return groups
  return groups
    .map((group) => {
      const links = group.links.flatMap((link) => filterNavLinkByAcl(link, allowed))
      if (links.length === 0) return null
      if (group.href && !adminHrefAllowed(group.href, false, allowed)) {
        const { href: _unused, ...rest } = group
        void _unused
        return { ...rest, links }
      }
      return { ...group, links }
    })
    .filter((g): g is AdminNavGroup => g != null)
}
