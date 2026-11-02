'use client'

import React from 'react'
import Link from 'next/link'

export type FormsAdminTab = 'forms' | 'submissions'

const TABS: { id: FormsAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'forms',
    label: 'Forms',
    href: '/app/admin/forms',
    title: 'Form definitions + visual builder',
  },
  {
    id: 'submissions',
    label: 'Submissions',
    href: '/app/admin/forms/submissions',
    title: 'Form submissions inbox',
  },
]

/** Horizontal Forms chrome — Forms + Submissions only (module settings live under Form edit tabs / Site Chrome Mailer). */
export function FormsAdminNav({ active }: { active: FormsAdminTab }) {
  return (
    <nav className="layouts-admin-nav sf-forms-admin-nav" aria-label="Forms">
      <div className="layouts-admin-tabs" role="tablist">
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <Link
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              title={tab.title}
              className={`layouts-admin-tab${isActive ? ' is-active' : ''}`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
