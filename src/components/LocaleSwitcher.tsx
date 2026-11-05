'use client'

import React from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

import { usePathname } from '@/core/i18n/navigation'
import { labelForLocale, type LocaleCatalogEntry } from '@/core/i18n/locales'
import { withLocalePrefix } from '@/core/i18n/path'

type Props = {
  /** Enabled public locales (code + label from Localization catalog). */
  locales: readonly LocaleCatalogEntry[] | readonly string[]
  /** Optional landmark label override. */
  ariaLabel?: string
  /** `codes` = EN/HU; `labels` = English/Magyar (default). */
  display?: 'labels' | 'codes'
}

function toEntries(
  locales: readonly LocaleCatalogEntry[] | readonly string[],
): LocaleCatalogEntry[] {
  return locales.map((entry) =>
    typeof entry === 'string'
      ? { code: entry, label: labelForLocale(entry) }
      : { code: entry.code, label: entry.label || labelForLocale(entry.code) },
  )
}

/**
 * Public locale switcher — same bare path, different `/{locale}` prefix.
 * Hidden when fewer than two enabled locales.
 * Uses plain prefixed hrefs so admin-added codes work outside next-intl's
 * static bootstrap routing list.
 * Client-safe imports only (no i18n barrel / server `enabled`).
 */
export function LocaleSwitcher({
  locales,
  ariaLabel,
  display = 'labels',
}: Props) {
  const pathname = usePathname() || '/'
  const current = useLocale()
  const t = useTranslations('Locale')

  const enabled = toEntries(locales).filter((e) => e.code)
  if (enabled.length < 2) return null

  const label = (ariaLabel && ariaLabel.trim()) || t('switcherLabel')

  return (
    <nav className="sf-locale-switcher" aria-label={label} data-sf-locale-switcher="">
      <ul className="sf-locale-switcher-list">
        {enabled.map((entry) => {
          const active = entry.code === current
          const text =
            display === 'codes' ? entry.code.toUpperCase() : entry.label || entry.code
          const href = withLocalePrefix(pathname, entry.code)
          return (
            <li key={entry.code}>
              {active ? (
                <span className="sf-locale-switcher-current" aria-current="true">
                  {text}
                </span>
              ) : (
                <Link href={href} className="sf-locale-switcher-link" hrefLang={entry.code}>
                  {text}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
