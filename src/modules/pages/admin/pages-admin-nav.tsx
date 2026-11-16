'use client'

import React from 'react'
import Link from 'next/link'

export type PagesAdminTab = 'pages' | 'categories'

type Chrome = {
  pages: string
  categories: string
  pagesTitle: string
  categoriesTitle: string
}

/** Horizontal Pages admin chrome. */
export function PagesAdminNav({
  active,
  chrome,
}: {
  active: PagesAdminTab
  chrome: Chrome
}) {
  const tabs: {
    id: PagesAdminTab
    label: string
    href: string
    title: string
  }[] = [
    {
      id: 'pages',
      label: chrome.pages,
      href: '/admin/pages',
      title: chrome.pagesTitle,
    },
    {
      id: 'categories',
      label: chrome.categories,
      href: '/admin/pages/categories',
      title: chrome.categoriesTitle,
    },
  ]

  return (
    <nav className="gantry-layouts-nav sf-pages-admin-nav" aria-label="Pages">
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
