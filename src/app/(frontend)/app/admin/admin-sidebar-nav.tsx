'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type AdminSidebarLink = {
  href: string
  label: string
  /** Exact match only (e.g. Check site → `/`). */
  exact?: boolean
  /** Treat as external to Core admin (CMS `/admin`). */
  external?: boolean
}

export type AdminSidebarGroup = {
  id: string
  label: string
  /** Default landing when the group header is a link. */
  href?: string
  links: AdminSidebarLink[]
}

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

/**
 * Joomla-style Core admin sidebar: collapsible groups + mobile accordion.
 * Accordion carets are CSS SVG backgrounds on empty spans (admin-dark.css) —
 * keep markup empty so they never double with unicode or inline SVG.
 */
export function AdminSidebarNav({
  groups,
  brand,
  who,
}: {
  groups: AdminSidebarGroup[]
  brand: React.ReactNode
  who: React.ReactNode
}) {
  const pathname = usePathname() || '/'
  const activeIds = useMemo(
    () => new Set(groups.filter((g) => groupIsActive(pathname, g)).map((g) => g.id)),
    [groups, pathname],
  )

  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(activeIds))
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      for (const id of activeIds) next.add(id)
      return next
    })
    setMobileOpen(false)
  }, [pathname, activeIds])

  function toggleGroup(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className="admin-sidebar" data-mobile-open={mobileOpen ? 'true' : 'false'}>
      <div className="admin-sidebar-top">
        <div className="admin-sidebar-brand">{brand}</div>
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
      </div>

      <div className="admin-sidebar-who">{who}</div>

      <nav id="admin-sidebar-nav" className="admin-sidebar-nav" aria-label="Starforge admin">
        <ul className="admin-sidebar-list">
          {groups.map((group) => {
            const hasChildren = group.links.length > 1
            const isOpen = hasChildren ? openIds.has(group.id) : true
            const isActive = activeIds.has(group.id)
            const primary = group.links[0]

            if (!hasChildren && primary) {
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
              >
                <button
                  type="button"
                  className="admin-sidebar-group-head"
                  aria-expanded={isOpen}
                  aria-controls={`admin-sidebar-sub-${group.id}`}
                  onClick={() => toggleGroup(group.id)}
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
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={`admin-sidebar-sublink${current ? ' is-current' : ''}`}
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
    </aside>
  )
}
