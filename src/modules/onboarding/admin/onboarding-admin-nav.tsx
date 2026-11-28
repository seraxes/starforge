'use client'

import React from 'react'
import Link from 'next/link'

export type OnboardingAdminTab = 'people' | 'statuses' | 'training' | 'settings'

const TABS: { id: OnboardingAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'people',
    label: 'People',
    href: '/admin/onboarding',
    title: 'Workers table and invite',
  },
  {
    id: 'statuses',
    label: 'Statuses',
    href: '/admin/onboarding/statuses',
    title: 'Status builder',
  },
  {
    id: 'training',
    label: 'Training',
    href: '/admin/onboarding/training',
    title: 'Reports, trainer calendar, qualifications',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/onboarding/settings',
    title: 'Invite and event-type email bindings',
  },
]

/** Horizontal Onboarding admin chrome (Events / Page Settings family). */
export function OnboardingAdminNav({ active }: { active: OnboardingAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-onboarding-admin-nav" aria-label="Onboarding">
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
