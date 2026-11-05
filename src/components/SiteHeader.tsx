import React from 'react'

import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { SiteNav } from '@/components/SiteNav'
import { Link } from '@/core/i18n'
import type { LocaleCatalogEntry } from '@/core/i18n/locales'
import type { NavItem } from '@/core/settings/defaults'

type Props = {
  siteName: string
  primaryNav: NavItem[]
  /** Compact brand-only header (e.g. auth pages). */
  compact?: boolean
  /** When false, omit brand text (Logo particle owns the mark). Default true. */
  showBrand?: boolean
  /** Enabled public locales for the chrome locale switcher (P2). */
  localesEnabled?: readonly LocaleCatalogEntry[] | readonly string[]
}

/**
 * Public site chrome — brand + primary nav from site settings / Nav manager.
 * Prefer Logo + Menu particles for flexible layouts; this is the combo shortcut.
 * Locale switcher appears when Localization has 2+ enabled locales.
 */
export function SiteHeader({
  siteName,
  primaryNav,
  compact = false,
  showBrand = true,
  localesEnabled = [],
}: Props) {
  const brand = showBrand ? (
    <p className="brand site-brand">
      <Link href="/">{siteName}</Link>
    </p>
  ) : null
  const nav = !compact && primaryNav.length > 0 ? <SiteNav items={primaryNav} /> : null
  const switcher =
    localesEnabled.length > 1 ? (
      <LocaleSwitcher locales={localesEnabled} />
    ) : null
  if (!brand && !nav && !switcher) return null

  return (
    <header className={`site-header${compact ? ' site-header-compact' : ''}`}>
      {brand}
      {nav}
      {switcher}
    </header>
  )
}
