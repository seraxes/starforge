'use client'

import React from 'react'
import Link from 'next/link'

export type MediaAdminTab = 'library' | 'settings'

const TABS: { id: MediaAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'library',
    label: 'Library',
    href: '/app/admin/media',
    title: 'Upload, filter, and manage media files',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/app/admin/media/settings',
    title: 'Resize, WebP/JPEG quality, PNG for logos',
  },
]

/** Horizontal Media chrome — Library + Settings. */
export function MediaAdminNav({ active }: { active: MediaAdminTab }) {
  return (
    <nav className="layouts-admin-nav sf-media-admin-nav" aria-label="Media">
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
