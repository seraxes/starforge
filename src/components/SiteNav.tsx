'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { NavItem } from '@/core/settings/defaults'
import { isExternalHref, isNavItemActive } from '@/core/settings/nav'

type Props = {
  items: NavItem[]
}

function linkClassName(item: NavItem, active: boolean): string | undefined {
  const parts: string[] = []
  if (item.cssClass?.trim()) parts.push(item.cssClass.trim())
  if (active) parts.push('is-active')
  return parts.length > 0 ? parts.join(' ') : undefined
}

/**
 * Primary header links with active state for the current path.
 * Optional per-item CSS class comes from Nav manager.
 */
export function SiteNav({ items }: Props) {
  const pathname = usePathname() || '/'

  if (items.length === 0) return null

  return (
    <nav className="site-nav" aria-label="Primary">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href)
        const className = linkClassName(item, active)
        const key = `${item.href}-${item.label}-${item.cssClass ?? ''}`

        if (isExternalHref(item.href)) {
          return (
            <a
              key={key}
              href={item.href}
              className={className}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.label}
            </a>
          )
        }

        return (
          <Link
            key={key}
            href={item.href}
            className={className}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
