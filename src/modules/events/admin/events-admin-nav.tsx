'use client'

import React from 'react'
import Link from 'next/link'

export type EventsAdminTab = 'events' | 'venues' | 'settings'

const TABS: { id: EventsAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'events',
    label: 'Events',
    href: '/admin/events',
    title: 'Event list and edit',
  },
  {
    id: 'venues',
    label: 'Venues',
    href: '/admin/events/venues',
    title: 'Venue list and edit',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/events/settings',
    title: 'Events module settings',
  },
]

/** Horizontal Events admin chrome — Events + Venues + Settings. */
export function EventsAdminNav({ active }: { active: EventsAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-events-admin-nav" aria-label="Events">
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
