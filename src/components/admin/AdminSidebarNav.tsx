'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { AdminNavGroup, AdminNavLink } from '@/core/admin-nav'

export type AdminSidebarLink = AdminNavLink
export type AdminSidebarGroup = AdminNavGroup

function pathMatches(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href
  if (pathname === href) return true
  if (href !== '/' && pathname.startsWith(`${href}/`)) return true
  return false
}

function groupIsActive(pathname: string, group: AdminSidebarGroup): boolean {
  if (group.href && pathMatches(pathname, group.href)) return true
  return group.links.some((link) => pathMatches(pathname, link.href, link.exact))
}

/** Accordion when flagged expandable or when there is more than one leaf. */
function groupIsExpandable(group: AdminSidebarGroup): boolean {
  if (group.expandable) return true
  return group.links.length > 1
}

export type AdminSidebarNavVariant = 'shell' | 'embedded'

/**
 * Joomla-style admin sidebar: collapsible groups + mobile accordion.
 * Accordion carets are CSS SVG backgrounds on empty spans (theme core-chrome) —
 * keep markup empty so they never double with unicode or inline SVG.
 *
 * - `shell` — full sticky aside (Core `/app/admin`)
 * - `embedded` — fill Payload `NavWrapper` aside (no nested sticky rail)
 *
 * Remounts on pathname change (inner `key`) so active groups open and mobile
 * accordion resets without setState-in-effect.
 */
export function AdminSidebarNav(props: {
  groups: AdminSidebarGroup[]
  brand: React.ReactNode
  who?: React.ReactNode
  variant?: AdminSidebarNavVariant
  navLabel?: string
}) {
  const pathname = usePathname() || '/'
  return <AdminSidebarNavInner key={pathname} pathname={pathname} {...props} />
}

function AdminSidebarNavInner({
  pathname,
  groups,
  brand,
  who,
  variant = 'shell',
  navLabel = 'Starforge admin',
}: {
  pathname: string
  groups: AdminSidebarGroup[]
  brand: React.ReactNode
  who?: React.ReactNode
  variant?: AdminSidebarNavVariant
  navLabel?: string
}) {
  const activeIds = useMemo(
    () => new Set(groups.filter((g) => groupIsActive(pathname, g)).map((g) => g.id)),
    [groups, pathname],
  )

  const [openIds, setOpenIds] = useState<Set<string>>(() => {
    const next = new Set(activeIds)
    for (const group of groups) {
      if (group.defaultOpen && groupIsExpandable(group)) next.add(group.id)
    }
    return next
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleGroup(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const Root: 'aside' | 'div' = variant === 'embedded' ? 'div' : 'aside'
  const rootClass =
    variant === 'embedded'
      ? 'admin-sidebar admin-sidebar--embedded'
      : 'admin-sidebar'

  return (
    <Root className={rootClass} data-mobile-open={mobileOpen ? 'true' : 'false'}>
      <div className="admin-sidebar-top">
        <div className="admin-sidebar-brand">{brand}</div>
        {variant === 'shell' ? (
          <button
            type="button"
            className="admin-sidebar-menu-toggle"
            aria-expanded={mobileOpen}
            aria-controls="admin-sidebar-nav"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span className="admin-sidebar-menu-toggle-label">Menu</span>
            <span
              className={`admin-sidebar-menu-toggle-icon${mobileOpen ? ' is-open' : ''}`}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      {who ? <div className="admin-sidebar-who">{who}</div> : null}

      <nav id="admin-sidebar-nav" className="admin-sidebar-nav" aria-label={navLabel}>
        <ul className="admin-sidebar-list">
          {groups.map((group) => {
            const expandable = groupIsExpandable(group)
            const isActive = activeIds.has(group.id)
            // Active groups always show children — collapsing the current section
            // made Media look like a flat highlighted leaf on /app/admin/media.
            const isOpen = expandable ? openIds.has(group.id) || isActive : true
            const primary = group.links[0]

            if (!expandable && primary) {
              return (
                <li
                  key={group.id}
                  className={`admin-sidebar-item${isActive ? ' is-active' : ''}`}
                >
                  <Link
                    href={primary.href}
                    className={`admin-sidebar-link${
                      pathMatches(pathname, primary.href, primary.exact) ? ' is-current' : ''
                    }`}
                    {...(primary.external ? { target: '_self' } : {})}
                  >
                    {group.label}
                  </Link>
                </li>
              )
            }

            return (
              <li
                key={group.id}
                className={`admin-sidebar-item admin-sidebar-group${isActive ? ' is-active' : ''}${
                  isOpen ? ' is-open' : ''
                }`}
                data-nav-group={group.id}
                data-nav-children={group.links.length}
              >
                <button
                  type="button"
                  className="admin-sidebar-group-head"
                  aria-expanded={isOpen}
                  aria-controls={`admin-sidebar-sub-${group.id}`}
                  onClick={() => {
                    // Do not collapse the section that owns the current route.
                    if (isActive && isOpen) return
                    toggleGroup(group.id)
                  }}
                >
                  <span className="admin-sidebar-group-title">{group.label}</span>
                  <span
                    className={`admin-sidebar-group-toggle${isOpen ? ' is-open' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen ? (
                  <ul
                    id={`admin-sidebar-sub-${group.id}`}
                    className="admin-sidebar-sub"
                    aria-label={`${group.label} submenu`}
                  >
                    {group.links.map((link) => {
                      const current = pathMatches(pathname, link.href, link.exact)
                      return (
                        <li key={`${group.id}:${link.href}`}>
                          <Link
                            href={link.href}
                            className={`admin-sidebar-sublink${current ? ' is-current' : ''}`}
                            {...(link.external ? { target: '_self' } : {})}
                          >
                            {link.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ul>
      </nav>
    </Root>
  )
}
