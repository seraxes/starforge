'use client'

import React from 'react'
import Link from 'next/link'

export type MapsAdminTab = 'rooms' | 'edit'

const TABS: { id: MapsAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'rooms',
    label: 'Live maps',
    href: '/admin/maps',
    title: 'Live map rooms',
  },
]

/** Horizontal Maps admin chrome — same Gantry tab pattern as Layouts / Events. */
export function MapsAdminNav({
  active,
  editHref,
  editLabel,
}: {
  active: MapsAdminTab
  editHref?: string
  editLabel?: string
}) {
  const tabs = [...TABS]
  if (editHref) {
    tabs.push({
      id: 'edit',
      label: editLabel || 'Room',
      href: editHref,
      title: 'Edit live map room',
    })
  }

  return (
    <nav className="gantry-layouts-nav sf-maps-admin-nav" aria-label="Maps">
      <ul className="gantry-layouts-nav-tabs" role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === active
          return (
            <li key={tab.id}>
              <Link
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                title={tab.title}
                className={
                  isActive
                    ? 'gantry-layouts-nav-tab is-active'
                    : 'gantry-layouts-nav-tab'
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
