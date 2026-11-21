'use client'

import React from 'react'
import { useLocale } from 'next-intl'

import { Link, usePathname } from '@/core/i18n/navigation'
import { coerceAppLocale, isLocaleAwareNavItemActive, navHref } from '@/core/i18n/nav'
import type { NavItem } from '@/core/settings/defaults'
import { isExternalHref, normalizeHref } from '@/core/settings/nav'

type Props = {
  items: NavItem[]
  /** Accessible name for the nav landmark (default: Primary). */
  ariaLabel?: string
}

function linkClassName(item: NavItem, active: boolean): string | undefined {
  const parts: string[] = []
  if (item.cssClass?.trim()) parts.push(item.cssClass.trim())
  if (active) parts.push('is-active')
  return parts.length > 0 ? parts.join(' ') : undefined
}

function itemKey(item: NavItem, index: number): string {
  return `${item.href}-${item.label}-${item.cssClass ?? ''}-${index}`
}

function itemOrDescendantActive(pathname: string, item: NavItem): boolean {
  if (isLocaleAwareNavItemActive(pathname, item.href)) return true
  return (item.children ?? []).some((child) => itemOrDescendantActive(pathname, child))
}

function SiteNavLink({
  item,
  pathname,
  locale,
  className,
}: {
  item: NavItem
  pathname: string
  locale: ReturnType<typeof coerceAppLocale>
  className?: string
}) {
  const active = isLocaleAwareNavItemActive(pathname, item.href)

  if (isExternalHref(item.href)) {
    return (
      <a
        href={item.href}
        className={className ?? linkClassName(item, active)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {item.label}
      </a>
    )
  }

  const bare = normalizeHref(item.href) || '/'
  // Core `/admin` and Payload `/cms` sit outside `[locale]` — plain anchor.
  if (bare === '/admin' || bare.startsWith('/admin/') || bare === '/cms' || bare.startsWith('/cms/')) {
    return (
      <a
        href={bare}
        className={className ?? linkClassName(item, active)}
        aria-current={active ? 'page' : undefined}
        data-sf-nav-href={bare}
      >
        {item.label}
      </a>
    )
  }

  // Bare path for next-intl Link (auto-prefixes). `data-sf-nav-href` exposes
  // the locale-prefixed URL for tests / debugging via Core `navHref`.
  return (
    <Link
      href={bare}
      className={className ?? linkClassName(item, active)}
      aria-current={active ? 'page' : undefined}
      data-sf-nav-href={navHref(bare, locale)}
    >
      {item.label}
    </Link>
  )
}

function SiteNavNode({
  item,
  pathname,
  locale,
}: {
  item: NavItem
  pathname: string
  locale: ReturnType<typeof coerceAppLocale>
}) {
  const children = item.children ?? []
  if (children.length === 0) {
    return <SiteNavLink item={item} pathname={pathname} locale={locale} />
  }

  const selfActive = isLocaleAwareNavItemActive(pathname, item.href)
  const branchActive = itemOrDescendantActive(pathname, item)
  const triggerClass = linkClassName(item, selfActive || branchActive)

  return (
    <div
      className={`site-nav-dropdown${branchActive ? ' is-active' : ''}`}
      data-sf-nav-has-children={children.length}
    >
      <SiteNavLink
        item={item}
        pathname={pathname}
        locale={locale}
        className={[triggerClass, 'site-nav-dropdown-trigger'].filter(Boolean).join(' ')}
      />
      <ul className="site-nav-submenu" aria-label={`${item.label} submenu`}>
        {children.map((child, childIndex) => (
          <li key={itemKey(child, childIndex)}>
            <SiteNavNode item={child} pathname={pathname} locale={locale} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Primary header links with active state for the current path.
 * Nested Nav manager items render as hover/focus dropdowns.
 * Nav manager stores bare paths; next-intl `Link` keeps the current locale prefix (P2).
 * Imports navigation/nav directly — not the i18n barrel (avoids server-only `enabled`).
 */
export function SiteNav({ items, ariaLabel = 'Primary' }: Props) {
  const pathname = usePathname() || '/'
  const locale = coerceAppLocale(useLocale())

  if (items.length === 0) return null

  return (
    <nav className="site-nav" aria-label={ariaLabel || 'Primary'}>
      {items.map((item, index) => (
        <SiteNavNode
          key={itemKey(item, index)}
          item={item}
          pathname={pathname}
          locale={locale}
        />
      ))}
    </nav>
  )
}
