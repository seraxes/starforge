'use client'

import React from 'react'
import Link from 'next/link'

export type SubscriptionsAdminTab = 'plans' | 'subscribers' | 'settings'

const TABS: {
  id: SubscriptionsAdminTab
  label: string
  href: string
  title: string
}[] = [
  {
    id: 'plans',
    label: 'Plans',
    href: '/admin/subscriptions',
    title: 'Subscription plans by subject',
  },
  {
    id: 'subscribers',
    label: 'Subscribers',
    href: '/admin/subscriptions/subscribers',
    title: 'Active and past subscription periods',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/subscriptions/settings',
    title: 'Pack defaults, reminders, and deep-links',
  },
]

/** Horizontal Subscriptions admin chrome (Events/Layouts pattern). */
export function SubscriptionsAdminNav({ active }: { active: SubscriptionsAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-subscriptions-admin-nav" aria-label="Subscriptions">
      <ul className="gantry-layouts-nav-tabs" role="tablist">
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                title={tab.title}
                className={
                  isActive ? 'gantry-layouts-nav-tab is-active' : 'gantry-layouts-nav-tab'
                }
              >
                <span className="gantry-layouts-nav-tab-label">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
