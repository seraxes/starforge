'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  addNavMenuItemAction,
  moveNavMenuItemAction,
  pasteNavMenuItemAction,
  saveNavMenuItemsAction,
  type NavActionState,
} from '@/core/nav/actions'
import type { NavMenuItem, NavPageOption } from '@/core/nav/types'

type EditableItem = {
  id: string
  parentId: string
  label: string
  linkType: 'page' | 'custom'
  pageId: string
  url: string
  cssClass: string
  browserTitle: string
  pageHeading: string
  accessKind: 'public' | 'registered' | 'group'
  accessGroupId: string
}

type Props = {
  menuId: string
  menuLabel: string
  items: NavMenuItem[]
  pages: NavPageOption[]
  isSitePrimary: boolean
}

const initial: NavActionState = {}

function toEditable(item: NavMenuItem): EditableItem {
  const access = String(item.accessLevel || 'public')
  let accessKind: EditableItem['accessKind'] = 'public'
  let accessGroupId = ''
  if (access === 'registered') accessKind = 'registered'
  else if (access.startsWith('group:')) {
    accessKind = 'group'
    accessGroupId = access.slice('group:'.length)
  }

  return {
    id: item.id,
    parentId: item.parentId ?? '',
    label: item.label,
    linkType: item.linkType === 'custom' ? 'custom' : 'page',
    pageId: item.pageId != null ? String(item.pageId) : '',
    url: item.url ?? '',
    cssClass: item.cssClass ?? '',
    browserTitle: item.browserTitle ?? '',
    pageHeading: item.pageHeading ?? '',
    accessKind,
    accessGroupId,
  }
}

function Feedback({ state }: { state: NavActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function appendItemFields(form: HTMLFormElement, rows: EditableItem[]) {
  for (const row of rows) {
    const add = (name: string, value: string) => {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
    add('itemId', row.id)
    add('itemLabel', row.label)
    add('itemLinkType', row.linkType)
    add('itemPageId', row.pageId)
    add('itemUrl', row.url)
    add('itemParentId', row.parentId)
    add('itemCssClass', row.cssClass)
    add('itemBrowserTitle', row.browserTitle)
    add('itemPageHeading', row.pageHeading)
    add('itemAccessLevel', row.accessKind)
    add('itemAccessGroupId', row.accessGroupId)
  }
}

export function NavItemsEditor({ menuId, menuLabel, items, pages, isSitePrimary }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<EditableItem[]>(() => items.map(toEditable))
  const [clipboard, setClipboard] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    setRows(items.map(toEditable))
  }, [items])

  const [saveState, saveAction, savePending] = useActionState(saveNavMenuItemsAction, initial)
  const [moveState, moveAction, movePending] = useActionState(moveNavMenuItemAction, initial)
  const [addState, addAction, addPending] = useActionState(addNavMenuItemAction, initial)
  const [pasteState, pasteAction, pastePending] = useActionState(pasteNavMenuItemAction, initial)

  const parentOptions = useMemo(
    () => rows.map((r) => ({ id: r.id, label: r.label })),
    [rows],
  )

  const refresh = () => router.refresh()

  const updateRow = (id: string, patch: Partial<EditableItem>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeRow = (id: string) => {
    setRows((prev) =>
      prev
        .filter((row) => row.id !== id)
        .map((row) => (row.parentId === id ? { ...row, parentId: '' } : row)),
    )
  }

  const copyRow = (row: EditableItem) => {
    const payload = {
      label: row.label,
      linkType: row.linkType,
      pageId: row.pageId ? Number(row.pageId) : null,
      url: row.url,
      parentId: null,
      cssClass: row.cssClass || null,
      browserTitle: row.browserTitle || null,
      pageHeading: row.pageHeading || null,
      accessLevel:
        row.accessKind === 'group' && row.accessGroupId
          ? `group:${row.accessGroupId}`
          : row.accessKind,
    }
    const json = JSON.stringify(payload)
    setClipboard(json)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(json)
    }
  }

  return (
    <div className="nav-items-editor">
      <p className="settings-hint">
        Menu: <strong>{menuLabel}</strong> (<code>{menuId}</code>)
        {isSitePrimary ? (
          <>
            {' '}
            · <span className="outlines-badge">Site primary</span>
          </>
        ) : null}{' '}
        · <Link href="/app/admin/nav">All menus</Link>
      </p>

      <Feedback state={saveState} />
      <Feedback state={moveState} />
      <Feedback state={addState} />
      <Feedback state={pasteState} />

      <form
        action={saveAction}
        className="nav-items-form"
        onSubmit={() => setTimeout(refresh, 80)}
      >
        <input type="hidden" name="menuId" value={menuId} />

        {rows.length === 0 ? (
          <p className="outlines-muted">No items yet — add one below.</p>
        ) : (
          <ul className="nav-items-list">
            {rows.map((row, index) => {
              const expanded = expandedId === row.id
              return (
                <li key={row.id} className="nav-item-card">
                  <input type="hidden" name="itemId" value={row.id} />
                  <div className="nav-item-card-head">
                    <button
                      type="button"
                      className="nav-item-toggle"
                      aria-expanded={expanded}
                      onClick={() => setExpandedId(expanded ? null : row.id)}
                    >
                      <span className="nav-item-index">{index + 1}</span>
                      <strong>{row.label || 'Untitled'}</strong>
                      <span className="outlines-muted">
                        {row.linkType === 'page'
                          ? pages.find((p) => String(p.id) === row.pageId)?.slug
                            ? `/${pages.find((p) => String(p.id) === row.pageId)!.slug}`
                            : 'CMS page'
                          : row.url || 'Custom URL'}
                      </span>
                    </button>
                    <div className="nav-item-quick">
                      <button
                        type="submit"
                        className="secondary"
                        formAction={moveAction}
                        disabled={movePending || index === 0}
                        name="direction"
                        value="up"
                        onClick={(e) => {
                          const form = e.currentTarget.form
                          if (!form) return
                          let moveItem = form.querySelector<HTMLInputElement>(
                            'input[name="moveItemId"]',
                          )
                          if (!moveItem) {
                            moveItem = document.createElement('input')
                            moveItem.type = 'hidden'
                            moveItem.name = 'moveItemId'
                            form.appendChild(moveItem)
                          }
                          moveItem.value = row.id
                        }}
                      >
                        Up
                      </button>
                      <button
                        type="submit"
                        className="secondary"
                        formAction={moveAction}
                        disabled={movePending || index === rows.length - 1}
                        name="direction"
                        value="down"
                        onClick={(e) => {
                          const form = e.currentTarget.form
                          if (!form) return
                          let moveItem = form.querySelector<HTMLInputElement>(
                            'input[name="moveItemId"]',
                          )
                          if (!moveItem) {
                            moveItem = document.createElement('input')
                            moveItem.type = 'hidden'
                            moveItem.name = 'moveItemId'
                            form.appendChild(moveItem)
                          }
                          moveItem.value = row.id
                        }}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => copyRow(row)}
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => removeRow(row.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Always submit current field values */}
                  <input type="hidden" name="itemLabel" value={row.label} />
                  <input type="hidden" name="itemLinkType" value={row.linkType} />
                  <input type="hidden" name="itemPageId" value={row.pageId} />
                  <input type="hidden" name="itemUrl" value={row.url} />
                  <input type="hidden" name="itemParentId" value={row.parentId} />
                  <input type="hidden" name="itemCssClass" value={row.cssClass} />
                  <input type="hidden" name="itemBrowserTitle" value={row.browserTitle} />
                  <input type="hidden" name="itemPageHeading" value={row.pageHeading} />
                  <input type="hidden" name="itemAccessLevel" value={row.accessKind} />
                  <input type="hidden" name="itemAccessGroupId" value={row.accessGroupId} />

                  {expanded ? (
                    <div className="nav-item-card-body">
                      <label className="settings-field">
                        <span>Label</span>
                        <input
                          type="text"
                          value={row.label}
                          onChange={(e) => updateRow(row.id, { label: e.target.value })}
                          required
                        />
                      </label>
                      <label className="settings-field">
                        <span>Link type</span>
                        <select
                          value={row.linkType}
                          onChange={(e) =>
                            updateRow(row.id, {
                              linkType: e.target.value === 'custom' ? 'custom' : 'page',
                            })
                          }
                        >
                          <option value="page">CMS page</option>
                          <option value="custom">Custom URL</option>
                        </select>
                      </label>
                      {row.linkType === 'page' ? (
                        <label className="settings-field">
                          <span>Page</span>
                          <select
                            value={row.pageId}
                            onChange={(e) => updateRow(row.id, { pageId: e.target.value })}
                          >
                            <option value="">Select page…</option>
                            {pages.map((p) => (
                              <option key={p.id} value={String(p.id)}>
                                {p.title} (/{p.slug})
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label className="settings-field">
                          <span>URL</span>
                          <input
                            type="text"
                            value={row.url}
                            placeholder="/about or https://…"
                            onChange={(e) => updateRow(row.id, { url: e.target.value })}
                          />
                        </label>
                      )}
                      <label className="settings-field">
                        <span>Parent (optional)</span>
                        <select
                          value={row.parentId}
                          onChange={(e) => updateRow(row.id, { parentId: e.target.value })}
                        >
                          <option value="">Top level</option>
                          {parentOptions
                            .filter((p) => p.id !== row.id)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="settings-field">
                        <span>CSS class</span>
                        <input
                          type="text"
                          value={row.cssClass}
                          placeholder="e.g. nav-highlight"
                          onChange={(e) => updateRow(row.id, { cssClass: e.target.value })}
                        />
                      </label>
                      <label className="settings-field">
                        <span>Browser title override</span>
                        <input
                          type="text"
                          value={row.browserTitle}
                          onChange={(e) => updateRow(row.id, { browserTitle: e.target.value })}
                        />
                      </label>
                      <label className="settings-field">
                        <span>Page heading override</span>
                        <input
                          type="text"
                          value={row.pageHeading}
                          onChange={(e) => updateRow(row.id, { pageHeading: e.target.value })}
                        />
                      </label>
                      <label className="settings-field">
                        <span>Access level (stub)</span>
                        <select
                          value={row.accessKind}
                          onChange={(e) =>
                            updateRow(row.id, {
                              accessKind: e.target.value as EditableItem['accessKind'],
                            })
                          }
                        >
                          <option value="public">Public</option>
                          <option value="registered">Registered</option>
                          <option value="group">Group id…</option>
                        </select>
                      </label>
                      {row.accessKind === 'group' ? (
                        <label className="settings-field">
                          <span>Group id (placeholder)</span>
                          <input
                            type="text"
                            value={row.accessGroupId}
                            placeholder="e.g. editors"
                            onChange={(e) =>
                              updateRow(row.id, { accessGroupId: e.target.value })
                            }
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        <div className="nav-items-toolbar">
          <button type="submit" className="primary" disabled={savePending}>
            {savePending ? 'Saving…' : 'Save items'}
          </button>
          <button
            type="submit"
            className="secondary"
            formAction={pasteAction}
            disabled={pastePending || !clipboard}
            onClick={(e) => {
              const form = e.currentTarget.form
              if (!form) return
              let clip = form.querySelector<HTMLInputElement>('input[name="clipboardJson"]')
              if (!clip) {
                clip = document.createElement('input')
                clip.type = 'hidden'
                clip.name = 'clipboardJson'
                form.appendChild(clip)
              }
              clip.value = clipboard
            }}
          >
            Paste item
          </button>
        </div>
      </form>

      <section className="nav-items-add" aria-label="Add menu item">
        <h3>Add item</h3>
        <form
          action={addAction}
          className="outlines-create-form"
          onSubmit={(e) => {
            const form = e.currentTarget
            appendItemFields(form, rows)
            setTimeout(refresh, 80)
          }}
        >
          <input type="hidden" name="menuId" value={menuId} />
          <label className="settings-field">
            <span>Label</span>
            <input type="text" name="newLabel" placeholder="About" required maxLength={120} />
          </label>
          <label className="settings-field">
            <span>Link type</span>
            <select name="newLinkType" defaultValue="page">
              <option value="page">CMS page</option>
              <option value="custom">Custom URL</option>
            </select>
          </label>
          <label className="settings-field">
            <span>Page</span>
            <select name="newPageId" defaultValue="">
              <option value="">Select…</option>
              {pages.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.title} (/{p.slug})
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>URL (if custom)</span>
            <input type="text" name="newUrl" placeholder="/path" />
          </label>
          <button type="submit" disabled={addPending}>
            {addPending ? 'Adding…' : 'Add item'}
          </button>
        </form>
      </section>
    </div>
  )
}
