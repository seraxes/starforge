'use client'

import React from 'react'
import Link from 'next/link'

export type MarketplaceAdminTab = 'categories' | 'listings' | 'settings'

const TABS: {
  id: MarketplaceAdminTab
  label: string
  href: string
  title: string
}[] = [
  {
    id: 'categories',
    label: 'Categories',
    href: '/admin/marketplace',
    title: 'Marketplace category tree',
  },
  {
    id: 'listings',
    label: 'Listings',
    href: '/admin/marketplace/listings',
    title: 'Listing moderation',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/marketplace/settings',
    title: 'Marketplace module settings',
  },
]

/** Horizontal Marketplace admin chrome (Events / Ads pattern). */
export function MarketplaceAdminNav({ active }: { active: MarketplaceAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-marketplace-admin-nav" aria-label="Marketplace">
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
