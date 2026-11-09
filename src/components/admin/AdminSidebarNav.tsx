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

function linkTreeIsActive(pathname: string, link: AdminNavLink): boolean {
  if (pathMatches(pathname, link.href, link.exact)) return true
  return (link.children ?? []).some((child) => linkTreeIsActive(pathname, child))
}

function groupIsActive(pathname: string, group: AdminSidebarGroup): boolean {
  if (group.href && pathMatches(pathname, group.href)) return true
  return group.links.some((link) => linkTreeIsActive(pathname, link))
}

/** Accordion when flagged expandable or when there is more than one leaf. */
function groupIsExpandable(group: AdminSidebarGroup): boolean {
  if (group.expandable) return true
  return group.links.length > 1
}

export type AdminSidebarNavVariant = 'shell' | 'embedded'

/**
 * Joomla-style admin sidebar: exclusive collapsible groups + mobile accordion.
 * Only one expandable main menu is open at a time.
 * Accordion carets are CSS SVG backgrounds on empty spans (theme core-chrome) —
 * keep markup empty so they never double with unicode or inline SVG.
 *
 * - `shell` — full sticky aside (Core `/admin`)
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

function NavLeafLink({
  pathname,
  link,
  className,
}: {
  pathname: string
  link: AdminNavLink
  className: string
}) {
  const current = pathMatches(pathname, link.href, link.exact)
  return (
    <Link
      href={link.href}
      className={`${className}${current ? ' is-current' : ''}`}
      {...(link.external ? { target: '_self' } : {})}
    >
      {link.label}
    </Link>
  )
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

  /** Exclusive accordion — at most one expandable main menu open. */
  const [openId, setOpenId] = useState<string | null>(() => {
    const activeExpandable = groups.find(
      (g) => groupIsExpandable(g) && activeIds.has(g.id),
    )
    if (activeExpandable) return activeExpandable.id
    const defaultExpandable = groups.find(
      (g) => g.defaultOpen && groupIsExpandable(g),
    )
    return defaultExpandable?.id ?? null
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleGroup(id: string) {
    setOpenId((prev) => (prev === id ? null : id))
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
            // Exclusive: only `openId` is expanded (active section seeds openId on mount).
            const isOpen = expandable ? openId === group.id : true
            const primary = group.links[0]

            if (!expandable && primary) {
              return (
                <li
                  key={group.id}
                  className={`admin-sidebar-item${isActive ? ' is-active' : ''}`}
                >
                  <NavLeafLink
                    pathname={pathname}
                    link={{ ...primary, label: group.label }}
                    className="admin-sidebar-link"
                  />
                </li>
              )
            }

            const titleCurrent =
              Boolean(group.href) && pathMatches(pathname, group.href!, false)

            return (
              <li
                key={group.id}
                className={`admin-sidebar-item admin-sidebar-group${isActive ? ' is-active' : ''}${
                  isOpen ? ' is-open' : ''
                }`}
                data-nav-group={group.id}
                data-nav-children={group.links.length}
              >
                <div className="admin-sidebar-group-head">
                  {group.href ? (
                    <Link
                      href={group.href}
                      className={`admin-sidebar-group-title${titleCurrent ? ' is-current' : ''}`}
                    >
                      {group.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="admin-sidebar-group-title"
                      aria-expanded={isOpen}
                      aria-controls={`admin-sidebar-sub-${group.id}`}
                      onClick={() => {
                        if (isActive && openId === group.id) return
                        toggleGroup(group.id)
                      }}
                    >
                      {group.label}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`admin-sidebar-group-toggle${isOpen ? ' is-open' : ''}`}
                    aria-expanded={isOpen}
                    aria-controls={`admin-sidebar-sub-${group.id}`}
                    aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${group.label}`}
                    onClick={() => {
                      // Do not collapse the section that owns the current route.
                      if (isActive && openId === group.id) return
                      toggleGroup(group.id)
                    }}
                  />
                </div>
                {isOpen ? (
                  <ul
                    id={`admin-sidebar-sub-${group.id}`}
                    className="admin-sidebar-sub"
                    aria-label={`${group.label} submenu`}
                  >
                    {group.links.map((link) => {
                      const nested = link.children ?? []
                      if (nested.length === 0) {
                        return (
                          <li key={`${group.id}:${link.href}`}>
                            <NavLeafLink
                              pathname={pathname}
                              link={link}
                              className="admin-sidebar-sublink"
                            />
                          </li>
                        )
                      }
                      return (
                        <li
                          key={`${group.id}:${link.href}`}
                          className="admin-sidebar-subitem has-nest"
                        >
                          <NavLeafLink
                            pathname={pathname}
                            link={link}
                            className="admin-sidebar-sublink"
                          />
                          <ul
                            className="admin-sidebar-subnest"
                            aria-label={`${link.label} submenu`}
                          >
                            {nested.map((child) => (
                              <li key={`${group.id}:${link.href}:${child.href}`}>
                                <NavLeafLink
                                  pathname={pathname}
                                  link={child}
                                  className="admin-sidebar-sublink admin-sidebar-nestlink"
                                />
                              </li>
                            ))}
                          </ul>
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
