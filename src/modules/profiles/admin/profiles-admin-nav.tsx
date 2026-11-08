'use client'

import React from 'react'
import Link from 'next/link'

export type ProfilesAdminTab = 'profiles' | 'settings'

const TABS: { id: ProfilesAdminTab; label: string; href: string; title: string }[] = [
  { id: 'profiles', label: 'Profiles', href: '/admin/profiles', title: 'Member directory and profile editor' },
  { id: 'settings', label: 'Settings', href: '/admin/profiles/settings', title: 'Fields, privacy defaults, uploads' },
]

/** Horizontal Profiles admin chrome (same tabs pattern as Events). */
export function ProfilesAdminNav({ active }: { active: ProfilesAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-profiles-admin-nav" aria-label="Profiles">
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
