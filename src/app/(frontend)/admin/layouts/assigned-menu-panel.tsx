'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'

import {
  listNavOutlineAssignmentsAction,
  toggleNavItemOutlineAssignmentAction,
} from '@/core/nav/actions'
import type { NavOutlineAssignmentMenu } from '@/core/nav/types'

type Props = {
  outlineId: string
  /** Outline display label for empty/help copy. */
  outlineLabel?: string
}

/**
 * Assigned Menu — one card per navigation menu (mosaic 50%), toggles for the active outline.
 * Primary nav (Main) is listed first; assignments match Navigation → Layout outline.
 */
export function AssignedMenuPanel({ outlineId, outlineLabel }: Props) {
  const [menus, setMenus] = useState<NavOutlineAssignmentMenu[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [loading, startLoad] = useTransition()
  const [toggling, startToggle] = useTransition()

  const load = useCallback(() => {
    const id = outlineId.trim()
    if (!id) return
    startLoad(async () => {
      setError(null)
      const result = await listNavOutlineAssignmentsAction(id)
      if ('error' in result) {
        setError(result.error)
        setMenus([])
        return
      }
      setMenus(result.menus)
    })
  }, [outlineId])

  useEffect(() => {
    load()
  }, [load])

  const onToggle = (menuId: string, itemId: string, assigned: boolean) => {
    const key = `${menuId}:${itemId}`
    setPendingKey(key)
    startToggle(async () => {
      setError(null)
      setMenus((prev) =>
        prev
          ? prev.map((menu) =>
              menu.menuId !== menuId
                ? menu
                : {
                    ...menu,
                    items: menu.items.map((item) =>
                      item.itemId !== itemId
                        ? item
                        : {
                            ...item,
                            assigned,
                            otherOutlineId: assigned ? null : item.otherOutlineId,
                            otherOutlineLabel: assigned ? null : item.otherOutlineLabel,
                          },
                    ),
                  },
            )
          : prev,
      )
      const result = await toggleNavItemOutlineAssignmentAction({
        menuId,
        itemId,
        outlineId,
        assigned,
      })
      if (result.error) {
        setError(result.error)
        load()
      }
      setPendingKey(null)
    })
  }

  const label = outlineLabel?.trim() || outlineId

  return (
    <div className="gantry-assigned-menu gantry-assigned-menu--page">
      <p className="settings-hint">
        Same assignment as <Link href="/admin/nav">Navigation</Link> → Layout outline. Primary menu
        items first. Toggle on to bind this outline; off clears the item (site default outline
        applies).
      </p>

      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !menus ? <p className="settings-hint">Loading menus…</p> : null}

      {menus && menus.length === 0 ? (
        <p className="settings-hint">
          No navigation menus yet. <Link href="/admin/nav">Create a menu</Link>
        </p>
      ) : null}

      {menus && menus.length > 0 ? (
        <div className="admin-settings-mosaic gantry-assigned-menu-mosaic">
          {menus.map((menu) => (
            <section
              key={menu.menuId}
              className={
                menu.isPrimary
                  ? 'page-settings-panel gantry-assigned-menu-card gantry-assigned-menu-card--primary'
                  : 'page-settings-panel gantry-assigned-menu-card'
              }
              aria-label={menu.isPrimary ? `${menu.menuLabel} (primary)` : menu.menuLabel}
            >
              <header className="page-settings-panel-head">
                <h3>
                  <Link href={`/admin/nav/${encodeURIComponent(menu.menuId)}`}>
                    {menu.menuLabel}
                  </Link>
                  {menu.isPrimary ? (
                    <span className="gantry-assigned-menu-primary-badge">Primary</span>
                  ) : null}
                </h3>
              </header>
              <div className="page-settings-panel-body">
                {menu.items.length === 0 ? (
                  <p className="settings-hint">No items</p>
                ) : (
                  <ul className="gantry-assigned-menu-items">
                    {menu.items.map((item) => {
                      const key = `${menu.menuId}:${item.itemId}`
                      const busy = toggling && pendingKey === key
                      const otherHint = item.otherOutlineLabel || item.otherOutlineId
                      return (
                        <li
                          key={item.itemId}
                          className="gantry-assigned-menu-item"
                          data-depth={item.depth}
                          style={{ paddingLeft: `${0.35 + item.depth * 0.85}rem` }}
                        >
                          <span className="gantry-assigned-menu-item-label" title={item.label}>
                            {item.label}
                            {otherHint ? (
                              <span
                                className="gantry-assigned-menu-other"
                                title={
                                  item.otherOutlineId
                                    ? `Currently on outline ${item.otherOutlineId}`
                                    : undefined
                                }
                              >
                                · {otherHint}
                              </span>
                            ) : null}
                          </span>
                          <div className="cms-switch gantry-assigned-menu-switch">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={item.assigned}
                              aria-label={`${item.assigned ? 'Unassign' : 'Assign'} “${item.label}”`}
                              className={
                                item.assigned ? 'cms-switch-track is-on' : 'cms-switch-track'
                              }
                              disabled={busy || loading}
                              onClick={() => onToggle(menu.menuId, item.itemId, !item.assigned)}
                            >
                              <span className="cms-switch-thumb" />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}
