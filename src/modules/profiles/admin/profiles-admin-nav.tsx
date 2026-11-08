'use client'

import React from 'react'
import Link from 'next/link'

export type ProfilesAdminTab = 'settings'

const TABS: { id: ProfilesAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/profiles/settings',
    title: 'Privacy defaults, uploads, handle cooldown',
  },
]

/** Profiles module chrome — settings only; members live under Users → Accounts. */
export function ProfilesAdminNav({ active }: { active: ProfilesAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-profiles-admin-nav" aria-label="Profiles">
      <ul className="gantry-layouts-nav-tabs" role="tablist">
        <li>
          <Link href="/admin/users" className="gantry-layouts-nav-tab" title="Core accounts directory">
            <span className="gantry-layouts-nav-tab-label">Accounts</span>
          </Link>
        </li>
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
