import React from 'react'
import Link from 'next/link'

import type { NavItem } from '@/core/settings'

type Props = {
  siteName: string
  primaryNav: NavItem[]
  /** Compact brand-only header (e.g. auth pages). */
  compact?: boolean
}

/**
 * Public site chrome — brand + primary nav from Payload site-settings global.
 */
export function SiteHeader({ siteName, primaryNav, compact = false }: Props) {
  return (
    <header className={`site-header${compact ? ' site-header-compact' : ''}`}>
      <p className="brand site-brand">
        <Link href="/">{siteName}</Link>
      </p>
      {!compact && primaryNav.length > 0 ? (
        <nav className="site-nav" aria-label="Primary">
          {primaryNav.map((item) => (
            <Link key={`${item.href}-${item.label}`} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  )
}
