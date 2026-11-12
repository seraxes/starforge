'use client'

import React from 'react'
import Link from 'next/link'

export type EmailAdminTab = 'rules' | 'templates' | 'sends' | 'broadcasts'

const TABS: { id: EmailAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'rules',
    label: 'Rules',
    href: '/admin/email',
    title: 'Automatic and conditional email rules',
  },
  {
    id: 'templates',
    label: 'Templates',
    href: '/admin/email/templates',
    title: 'Subject and body templates with merge fields',
  },
  {
    id: 'sends',
    label: 'Sends',
    href: '/admin/email/sends',
    title: 'Recent outbound send log',
  },
  {
    id: 'broadcasts',
    label: 'Broadcasts',
    href: '/admin/email/broadcasts',
    title: 'Paced bulk send queue and pace rules',
  },
]

/** Horizontal Email Manager chrome — Rules + Templates + Sends. */
export function EmailAdminNav({ active }: { active: EmailAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-email-admin-nav" aria-label="Email Manager">
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
