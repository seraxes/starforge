'use client'

import React from 'react'
import Link from 'next/link'

export type SocialAdminTab =
  | 'settings'
  | 'people'
  | 'groups'
  | 'pages'
  | 'media'
  | 'pending'
  | 'reports'

const TABS: { id: SocialAdminTab; label: string; href: string; title: string }[] = [
  {
    id: 'settings',
    label: 'Settings',
    href: '/admin/social',
    title: 'Social pack defaults and deep-links',
  },
  {
    id: 'people',
    label: 'People',
    href: '/admin/social/people',
    title: 'People, reactions, bans, reports settings',
  },
  {
    id: 'groups',
    label: 'Groups',
    href: '/admin/social/groups',
    title: 'Groups creation rules, categories, and verified list',
  },
  {
    id: 'pages',
    label: 'Pages',
    href: '/admin/social/pages',
    title: 'Pages creation rules, likes, and verified list',
  },
  {
    id: 'media',
    label: 'Media',
    href: '/admin/social/media',
    title: 'Stories, albums, media, and challenge settings',
  },
  {
    id: 'pending',
    label: 'Pending',
    href: '/admin/social/pending',
    title: 'Hold-new-posts-for-review queue',
  },
  {
    id: 'reports',
    label: 'Reports',
    href: '/admin/social/reports',
    title: 'Abuse report review queue',
  },
]

/** Horizontal Social admin chrome (Events/Layouts pattern). */
export function SocialAdminNav({ active }: { active: SocialAdminTab }) {
  return (
    <nav className="gantry-layouts-nav sf-social-admin-nav" aria-label="Social">
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
