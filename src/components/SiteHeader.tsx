import React from 'react'
import Link from 'next/link'

import { SiteNav } from '@/components/SiteNav'
import type { NavItem } from '@/core/settings/defaults'

type Props = {
  siteName: string
  primaryNav: NavItem[]
  /** Compact brand-only header (e.g. auth pages). */
  compact?: boolean
  /** When false, omit brand text (Logo particle owns the mark). Default true. */
  showBrand?: boolean
}

/**
 * Public site chrome — brand + primary nav from site settings / Nav manager.
 * Prefer Logo + Menu particles for flexible layouts; this is the combo shortcut.
 */
export function SiteHeader({
  siteName,
  primaryNav,
  compact = false,
  showBrand = true,
}: Props) {
  const brand = showBrand ? (
    <p className="brand site-brand">
      <Link href="/">{siteName}</Link>
    </p>
  ) : null
  const nav = !compact && primaryNav.length > 0 ? <SiteNav items={primaryNav} /> : null
  if (!brand && !nav) return null

  return (
    <header className={`site-header${compact ? ' site-header-compact' : ''}`}>
      {brand}
      {nav}
    </header>
  )
}
