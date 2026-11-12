import React from 'react'
import Link from 'next/link'

import { withLocalePrefix } from '@/core/i18n/path'

export type AccountNavTab = 'profile' | 'security' | 'events' | 'subscriptions'

/** Small member-account tab bar shared by Profile + Security + Events + Subscriptions. */
export function AccountNav({
  active,
  locale,
  handle,
  showEvents = true,
  showSubscriptions = false,
}: {
  active: AccountNavTab
  locale: string
  handle?: string
  /** When false, omit the Events tab (Events module off). */
  showEvents?: boolean
  /** When true, show Subscriptions (Subscriptions module on). */
  showSubscriptions?: boolean
}) {
  const tabs: Array<{ id: AccountNavTab; label: string; href: string }> = [
    { id: 'profile', label: 'Profile', href: withLocalePrefix('/account/profile', locale) },
    { id: 'security', label: 'Security', href: withLocalePrefix('/account/security', locale) },
  ]
  if (showEvents) {
    tabs.push({
      id: 'events',
      label: 'Events',
      href: withLocalePrefix('/account/events', locale),
    })
  }
  if (showSubscriptions) {
    tabs.push({
      id: 'subscriptions',
      label: 'Subscriptions',
      href: withLocalePrefix('/account/subscriptions', locale),
    })
  }
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
