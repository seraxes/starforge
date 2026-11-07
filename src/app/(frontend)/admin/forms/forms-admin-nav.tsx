'use client'

import React from 'react'
import Link from 'next/link'

export type FormsAdminTab = 'forms' | 'settings'

const TABS: { id: FormsAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'forms',
    label: 'Forms',
    href: '/admin/forms',
    title: 'Form definitions + visual builder',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/forms/settings',
    title: 'Forms module defaults + Mailer wiring',
  },
]

/** Horizontal Forms chrome — same Gantry nav language as Layouts / Events. */
export function FormsAdminNav({ active }: { active: FormsAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-forms-admin-nav" aria-label="Forms">
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
