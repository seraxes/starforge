'use client'

import React from 'react'
import Link from 'next/link'

export type AdsAdminTab = 'packages' | 'placements' | 'campaigns'

const TABS: {
  id: AdsAdminTab
  label: string
  href: string
  title: string
}[] = [
  {
    id: 'packages',
    label: 'Packages',
    href: '/admin/ads',
    title: 'Sellable ad packages and credit bundles',
  },
  {
    id: 'placements',
    label: 'Placements',
    href: '/admin/ads/placements',
    title: 'Where creatives may appear',
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    href: '/admin/ads/campaigns',
    title: 'Buyer campaigns (no go-live yet)',
  },
]

/** Horizontal Ads admin chrome (Events / Subscriptions pattern). */
export function AdsAdminNav({ active }: { active: AdsAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-ads-admin-nav" aria-label="Ads">
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
