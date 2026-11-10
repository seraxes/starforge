'use client'

import React, { useEffect, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { switchSkinFromLayoutsAction } from '@/core/skin/actions'
import { rememberAdminWorkingOutline } from '@/core/skin/admin-working-outline'
import { STARFORGE_PASTEL_SKIN_ID } from '@/core/skin/skins/starforge-pastel'

export type LayoutsAdminTab =
  | 'layout'
  | 'styles'
  | 'page-settings'
  | 'assigned-menu'
  | 'skins'
  | 'outlines'

type OutlineOption = { id: string; label: string }
type SkinOption = { id: string; label: string }

function withOutline(path: string, outlineId: string): string {
  const id = outlineId.trim()
  if (!id) return path
  const join = path.includes('?') ? '&' : '?'
  // Always carry outline so left-nav hops / tab switches keep the working selection.
  if (path.includes('outline=')) {
    return path.replace(/([?&])outline=[^&]*/, `$1outline=${encodeURIComponent(id)}`)
  }
  return `${path}${join}outline=${encodeURIComponent(id)}`
}

/** Top strip: Layout / Styles / Page Settings / Assigned Menu. Skins live in the left nav. */
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
    id: 'assigned-menu',
    label: 'Assigned Menu',
    href: '/admin/assigned-menu',
    icon: '⧉',
    title: 'Assign this outline to navigation menu items',
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

  // Keep working outline sticky across left-nav / menu changes (cookie per skin).
  useEffect(() => {
    if (skinId && outlineId) rememberAdminWorkingOutline(skinId, outlineId)
  }, [skinId, outlineId])

  const tabs = TABS.filter((tab) => {
    if (tab.id === 'layout' || tab.id === 'styles' || tab.id === 'assigned-menu') {
      return showLayoutTabs
    }
    if (tab.id === 'page-settings') return showPageSettingsTab
    return false
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
                  if (next && targetOutline) {
                    rememberAdminWorkingOutline(next, targetOutline)
                  }
                  // Left-nav-only surfaces — stay put; Outlines list reloads for the new skin.
                  if (active === 'skins' || active === 'outlines') {
                    if (active === 'outlines') {
                      router.push('/admin/outlines')
                    }
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
                  {skin.id === STARFORGE_PASTEL_SKIN_ID
                    ? `${skin.label} (default)`
                    : skin.label}
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
                if (skinId && next) rememberAdminWorkingOutline(skinId, next)
                const tab = TABS.find((t) => t.id === active)
                const path =
                  active === 'assigned-menu'
                    ? '/admin/assigned-menu'
                    : tab && tab.id !== 'layout'
                      ? tab.href
                      : '/admin/layouts'
                router.push(withOutline(path, next))
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
          const href = withOutline(tab.href, outlineId)
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
