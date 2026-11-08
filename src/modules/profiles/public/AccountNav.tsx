import React from 'react'
import Link from 'next/link'

import { withLocalePrefix } from '@/core/i18n/path'

export type AccountNavTab = 'profile' | 'security'

/** Small member-account tab bar shared by Profile + Security pages. */
export function AccountNav({
  active,
  locale,
  handle,
}: {
  active: AccountNavTab
  locale: string
  handle?: string
}) {
  const tabs: Array<{ id: AccountNavTab; label: string; href: string }> = [
    { id: 'profile', label: 'Profile', href: withLocalePrefix('/account/profile', locale) },
    { id: 'security', label: 'Security', href: withLocalePrefix('/account/security', locale) },
  ]
  return (
    <nav className="sf-account-nav" aria-label="Account">
      <ul>
        {tabs.map((tab) => (
          <li key={tab.id}>
            <Link
              href={tab.href}
              aria-current={tab.id === active ? 'page' : undefined}
              className={tab.id === active ? 'is-active' : undefined}
            >
              {tab.label}
            </Link>
          </li>
        ))}
        {handle ? (
          <li className="sf-account-nav-view">
            <Link href={withLocalePrefix(`/u/${handle}`, locale)}>View public profile</Link>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
