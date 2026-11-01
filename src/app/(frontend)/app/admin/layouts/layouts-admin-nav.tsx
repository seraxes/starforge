'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export type LayoutsAdminTab =
  | 'layout'
  | 'styles'
  | 'page-settings'
  | 'particle-defaults'

type OutlineOption = { id: string; label: string }

function withOutline(path: string, outlineId: string): string {
  if (!outlineId || outlineId === 'default') return path
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}outline=${encodeURIComponent(outlineId)}`
}

const TABS: {
  id: LayoutsAdminTab
  label: string
  href: string
  icon: string
  title: string
}[] = [
  {
    id: 'layout',
    label: 'Layout',
    href: '/app/admin/layouts',
    icon: '▦',
    title: 'Layout canvas',
  },
  {
    id: 'styles',
    label: 'Styles',
    href: '/app/admin/breakpoints',
    icon: '◐',
    title: 'Section styles + breakpoints',
  },
  {
    id: 'page-settings',
    label: 'Page Settings',
    href: '/app/admin/page-settings',
    icon: '☰',
    title: 'Page Settings',
  },
  {
    id: 'particle-defaults',
    label: 'Particle Defaults',
    href: '/app/admin/particle-defaults',
    icon: '🔧',
    title: 'Particle Defaults (stub)',
  },
]

/**
 * Gantry-like Layouts chrome: outline switcher + icon tabs.
 */
export function LayoutsAdminNav({
  active,
  outlines,
  currentOutlineId,
  showOutlineSwitcher = true,
  showLayoutTabs = true,
  showPageSettingsTab = true,
}: {
  active: LayoutsAdminTab
  outlines: OutlineOption[]
  currentOutlineId: string
  showOutlineSwitcher?: boolean
  showLayoutTabs?: boolean
  showPageSettingsTab?: boolean
}) {
  const router = useRouter()
  const outlineId = currentOutlineId || 'default'

  const tabs = TABS.filter((tab) => {
    if (tab.id === 'layout' || tab.id === 'styles' || tab.id === 'particle-defaults') {
      return showLayoutTabs
    }
    if (tab.id === 'page-settings') return showPageSettingsTab
    return true
  })

  return (
    <nav className="gantry-layouts-nav" aria-label="Layouts">
      {showOutlineSwitcher ? (
        <div className="gantry-layouts-nav-outline">
          <label className="gantry-layouts-nav-outline-label">
            <span className="sr-only">Outline</span>
            <select
              className="gantry-layouts-nav-outline-select"
              value={outlineId}
              aria-label="Switch layout outline"
              onChange={(event) => {
                const next = event.target.value
                const tab = TABS.find((t) => t.id === active) ?? TABS[0]!
                router.push(withOutline(tab.href, next))
              }}
            >
              {outlines.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <Link
            className="gantry-layouts-nav-outline-manage"
            href="/app/admin/outlines"
            title="Manage outlines"
          >
            ▾
          </Link>
        </div>
      ) : null}

      <ul className="gantry-layouts-nav-tabs">
        {tabs.map((tab) => {
          const activeTab = tab.id === active
          return (
            <li key={tab.id}>
              <Link
                href={withOutline(tab.href, outlineId)}
                className={
                  activeTab
                    ? 'gantry-layouts-nav-tab is-active'
                    : 'gantry-layouts-nav-tab'
                }
                aria-current={activeTab ? 'page' : undefined}
                title={tab.title}
              >
                <span className="gantry-layouts-nav-tab-icon" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="gantry-layouts-nav-tab-label">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
