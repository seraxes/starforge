import React from 'react'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { withLocalePrefix } from '@/core/i18n/path'

export type AccountNavTab = 'profile' | 'security' | 'events' | 'subscriptions'

/** Small member-account tab bar shared by Profile + Security + Events + Subscriptions. */
export async function AccountNav({
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
  const t = await getTranslations('product:profiles')
  const tabs: Array<{ id: AccountNavTab; label: string; href: string }> = [
    { id: 'profile', label: t('navProfile'), href: withLocalePrefix('/account/profile', locale) },
    { id: 'security', label: t('navSecurity'), href: withLocalePrefix('/account/security', locale) },
  ]
  if (showEvents) {
    tabs.push({
      id: 'events',
      label: t('navEvents'),
      href: withLocalePrefix('/account/events', locale),
    })
  }
  if (showSubscriptions) {
    tabs.push({
      id: 'subscriptions',
      label: t('navSubscriptions'),
      href: withLocalePrefix('/account/subscriptions', locale),
    })
  }
  return (
    <nav className="sf-account-nav" aria-label={t('accountNavAria')}>
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
            <Link href={withLocalePrefix(`/u/${handle}`, locale)}>{t('viewPublicProfile')}</Link>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
