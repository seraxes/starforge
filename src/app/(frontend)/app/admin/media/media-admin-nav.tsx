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

/** Horizontal Media chrome — Library + Settings (Gantry layouts tab classes). */
export function MediaAdminNav({ active }: { active: MediaAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-media-admin-nav" aria-label="Media">
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
