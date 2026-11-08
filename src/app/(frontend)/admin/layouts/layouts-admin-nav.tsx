'use client'

import React, { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { switchSkinFromLayoutsAction } from '@/core/skin/actions'

export type LayoutsAdminTab =
  | 'layout'
  | 'styles'
  | 'page-settings'
  | 'particle-defaults'
  | 'skins'

type OutlineOption = { id: string; label: string }
type SkinOption = { id: string; label: string }

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
  /** When true, tab stays visible even if layout canvas tabs are hidden. */
  always?: boolean
}[] = [
  {
    id: 'layout',
    label: 'Layout',
    href: '/admin/layouts',
    icon: '▦',
    title: 'Layout canvas',
  },
  {
    id: 'styles',
    label: 'Styles',
    href: '/admin/breakpoints',
    icon: '◐',
    title: 'Section styles + breakpoints',
  },
  {
    id: 'page-settings',
    label: 'Page Settings',
    href: '/admin/page-settings',
    icon: '☰',
    title: 'Page Settings',
  },
  {
    id: 'particle-defaults',
    label: 'Particle Defaults',
    href: '/admin/particle-defaults',
    icon: '🔧',
    title: 'Particle Defaults (stub)',
  },
  {
    id: 'skins',
    label: 'Skins',
    href: '/admin/skins',
    icon: '◈',
    title: 'Skins — brand + outline packs',
    always: true,
  },
]

/**
 * Gantry-like Layouts chrome: Skin picker + outline switcher + icon tabs.
 */
export function LayoutsAdminNav({
  active,
  outlines,
  currentOutlineId,
  showOutlineSwitcher = true,
  showLayoutTabs = true,
  showPageSettingsTab = true,
  skins = [],
  activeSkinId,
  skinPinnedByEnv = false,
}: {
  active: LayoutsAdminTab
  outlines: OutlineOption[]
  currentOutlineId: string
  showOutlineSwitcher?: boolean
  showLayoutTabs?: boolean
  showPageSettingsTab?: boolean
  skins?: SkinOption[]
  activeSkinId?: string
  skinPinnedByEnv?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const outlineId = currentOutlineId || 'default'
  const skinId = activeSkinId || skins[0]?.id || ''

  const tabs = TABS.filter((tab) => {
    if (tab.always) return true
    if (tab.id === 'layout' || tab.id === 'styles' || tab.id === 'particle-defaults') {
      return showLayoutTabs
    }
    if (tab.id === 'page-settings') return showPageSettingsTab
    return true
  })

  return (
    <nav className="gantry-layouts-nav" aria-label="Layouts">
      {skins.length > 0 ? (
        <div className="gantry-layouts-nav-outline gantry-layouts-nav-skin">
          <label className="gantry-layouts-nav-outline-label">
            <span className="sr-only">Skin</span>
            <select
              className="gantry-layouts-nav-outline-select"
              value={skinId}
              disabled={pending || skinPinnedByEnv}
              aria-label="Switch skin"
              title={skinPinnedByEnv ? 'Pinned by STARFORGE_SKIN' : 'Switch skin'}
              onChange={(event) => {
                const next = event.target.value
                if (!next || next === skinId) return
                startTransition(async () => {
                  const result = await switchSkinFromLayoutsAction(next)
                  if (result.error) {
                    window.alert(result.error)
                    router.refresh()
                    return
                  }
                  const tab = TABS.find((t) => t.id === active) ?? TABS[0]!
                  const targetOutline = result.preferredOutlineId || outlineId
                  if (tab.id === 'skins') {
                    router.refresh()
                    return
                  }
                  router.push(withOutline(tab.href, targetOutline))
                  router.refresh()
                })
              }}
            >
              {skins.map((skin) => (
                <option key={skin.id} value={skin.id}>
                  {skin.label}
                </option>
              ))}
            </select>
          </label>
          <Link
            className="gantry-layouts-nav-outline-manage"
            href="/admin/skins"
            title="Manage skins"
            aria-label="Manage skins"
          >
            ◈
          </Link>
        </div>
      ) : null}

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
                router.push(withOutline('/admin/layouts', next))
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
            href="/admin/outlines"
            title="Manage outlines"
            aria-label="Manage outlines"
          >
            ☰
          </Link>
        </div>
      ) : null}

      <ul className="gantry-layouts-nav-tabs">
        {tabs.map((tab) => {
          const activeTab = tab.id === active
          const href = tab.id === 'skins' ? tab.href : withOutline(tab.href, outlineId)
          return (
            <li key={tab.id}>
              <Link
                href={href}
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
