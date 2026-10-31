import React from 'react'
import Link from 'next/link'

import { SiteNav } from '@/components/SiteNav'
import type { NavItem } from '@/core/settings/defaults'

type Props = {
  siteName: string
  primaryNav: NavItem[]
  /** Compact brand-only header (e.g. auth pages). */
  compact?: boolean
}

/**
 * Public site chrome — brand + primary nav from Payload site-settings.
 * Nav items are resolved in core (`label` + `href`); active state is client-side.
 */
export function SiteHeader({ siteName, primaryNav, compact = false }: Props) {
  return (
    <header className={`site-header${compact ? ' site-header-compact' : ''}`}>
      <p className="brand site-brand">
        <Link href="/">{siteName}</Link>
      </p>
      {!compact ? <SiteNav items={primaryNav} /> : null}
    </header>
  )
}
