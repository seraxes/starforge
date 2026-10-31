'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { NavItem } from '@/core/settings/defaults'
import { isExternalHref, isNavItemActive } from '@/core/settings/nav'

type Props = {
  items: NavItem[]
}

/**
 * Primary header links with active state for the current path.
 */
export function SiteNav({ items }: Props) {
  const pathname = usePathname() || '/'

  if (items.length === 0) return null

  return (
    <nav className="site-nav" aria-label="Primary">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href)
        const className = active ? 'is-active' : undefined
        const key = `${item.href}-${item.label}`

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
