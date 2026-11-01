'use client'

import React, { useActionState, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import type { UserGroupOption } from '@/core/acl/types'
import {
  addNavMenuItemAction,
  moveNavMenuItemAction,
  pasteNavMenuItemAction,
  saveNavMenuItemsAction,
  type NavActionState,
} from '@/core/nav/actions'
import type { NavLinkType, NavMenuItem, NavModuleOption, NavPageOption } from '@/core/nav/types'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

type EditableItem = {
  id: string
  parentId: string
  label: string
  linkType: NavLinkType
  pageId: string
  url: string
  moduleId: string
  moduleViewKey: string
  cssClass: string
  browserTitle: string
  pageHeading: string
  /** Multi-select tags: public | registered | group:<id> (OR match). */
  accessTags: string[]
}

type Props = {
  menuId: string
  menuLabel: string
  items: NavMenuItem[]
  pages: NavPageOption[]
  modules: NavModuleOption[]
  groups: UserGroupOption[]
  isSitePrimary: boolean
}

const initial: NavActionState = {}

function toEditable(item: NavMenuItem): EditableItem {
  const tags =
    item.accessTags && item.accessTags.length > 0
      ? [...item.accessTags]
      : item.accessLevel
        ? [String(item.accessLevel)]
        : ['public']

  const linkType: NavLinkType =
    item.linkType === 'module' ? 'module' : item.linkType === 'url' ? 'url' : 'page'

  return {
    id: item.id,
    parentId: item.parentId ?? '',
    label: item.label,
    linkType,
    pageId: item.pageId != null ? String(item.pageId) : '',
    url: item.url ?? '',
    moduleId: item.moduleId ?? '',
    moduleViewKey: item.moduleViewKey ?? '',
    cssClass: item.cssClass ?? '',
    browserTitle: item.browserTitle ?? '',
    pageHeading: item.pageHeading ?? '',
    accessTags: tags,
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
    add('itemModuleId', row.moduleId)
    add('itemModuleViewKey', row.moduleViewKey)
    add('itemParentId', row.parentId)
    add('itemCssClass', row.cssClass)
    add('itemBrowserTitle', row.browserTitle)
    add('itemPageHeading', row.pageHeading)
    add('itemAccessTags', JSON.stringify(row.accessTags.length ? row.accessTags : ['public']))
  }
}

function summarizeLink(
  row: EditableItem,
  pages: NavPageOption[],
  modules: NavModuleOption[],
): string {
  if (row.linkType === 'page') {
    const page = pages.find((p) => String(p.id) === row.pageId)
    return page ? `/${page.slug}` : 'CMS page'
  }
  if (row.linkType === 'module') {
    const mod = modules.find((m) => m.moduleId === row.moduleId)
    const view = mod?.views.find((v) => v.key === row.moduleViewKey)
    if (mod && view) return `${mod.moduleLabel} → ${view.label}`
    return 'Module view'
  }
  return row.url || 'URL'
}

export function NavItemsEditor({
  menuId,
  menuLabel,
  items,
  pages,
  modules,
  groups,
  isSitePrimary,
}: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<EditableItem[]>(() => items.map(toEditable))
  const [clipboard, setClipboard] = useState<string>('')
  const [expandedId, setExpandedId] = useState<string | null>(items[0]?.id ?? null)
  const [newLinkType, setNewLinkType] = useState<NavLinkType>('page')
  const [newModuleId, setNewModuleId] = useState(modules[0]?.moduleId ?? '')

  const [saveState, saveAction, savePending] = useActionState(saveNavMenuItemsAction, initial)
  const [moveState, moveAction, movePending] = useActionState(moveNavMenuItemAction, initial)
  const [addState, addAction, addPending] = useActionState(addNavMenuItemAction, initial)
  const [pasteState, pasteAction, pastePending] = useActionState(pasteNavMenuItemAction, initial)
  useNotifySavedOnOk(saveState, { toastErrors: true })
  useNotifySavedOnOk(addState, { successMessage: 'Saved', toastErrors: true })
  useNotifySavedOnOk(pasteState, { successMessage: 'Saved', toastErrors: true })
  const { formRef, saveDebounced } = useAutosaveForm()
  const skipAutosave = React.useRef(true)
  const hydrating = React.useRef(false)

  useEffect(() => {
    hydrating.current = true
    setRows(items.map(toEditable))
    queueMicrotask(() => {
      hydrating.current = false
    })
  }, [items])

  useEffect(() => {
    if (skipAutosave.current) {
      skipAutosave.current = false
      return
    }
    if (hydrating.current) return
    saveDebounced()
  }, [rows, saveDebounced])

  const parentOptions = useMemo(
    () => rows.map((r) => ({ id: r.id, label: r.label })),
    [rows],
  )

  const newModuleViews = useMemo(
    () => modules.find((m) => m.moduleId === newModuleId)?.views ?? [],
    [modules, newModuleId],
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
      moduleId: row.moduleId || null,
      moduleViewKey: row.moduleViewKey || null,
      parentId: null,
      cssClass: row.cssClass || null,
      browserTitle: row.browserTitle || null,
      pageHeading: row.pageHeading || null,
      accessTags: row.accessTags.length ? row.accessTags : ['public'],
    }
    const json = JSON.stringify(payload)
    setClipboard(json)
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(json)
    }
  }

  const setMoveTarget = (form: HTMLFormElement | null, itemId: string) => {
    if (!form) return
    let moveItem = form.querySelector<HTMLInputElement>('input[name="moveItemId"]')
    if (!moveItem) {
      moveItem = document.createElement('input')
      moveItem.type = 'hidden'
      moveItem.name = 'moveItemId'
      form.appendChild(moveItem)
    }
    moveItem.value = itemId
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
        ref={formRef}
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
              const moduleViews =
                modules.find((m) => m.moduleId === row.moduleId)?.views ?? []
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
                        {summarizeLink(row, pages, modules)}
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
                        onClick={(e) => setMoveTarget(e.currentTarget.form, row.id)}
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
                        onClick={(e) => setMoveTarget(e.currentTarget.form, row.id)}
                      >
                        Down
                      </button>
                      <button type="button" className="secondary" onClick={() => copyRow(row)}>
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

                  <input type="hidden" name="itemLabel" value={row.label} />
                  <input type="hidden" name="itemLinkType" value={row.linkType} />
                  <input type="hidden" name="itemPageId" value={row.pageId} />
                  <input type="hidden" name="itemUrl" value={row.url} />
                  <input type="hidden" name="itemModuleId" value={row.moduleId} />
                  <input type="hidden" name="itemModuleViewKey" value={row.moduleViewKey} />
                  <input type="hidden" name="itemParentId" value={row.parentId} />
                  <input type="hidden" name="itemCssClass" value={row.cssClass} />
                  <input type="hidden" name="itemBrowserTitle" value={row.browserTitle} />
                  <input type="hidden" name="itemPageHeading" value={row.pageHeading} />
                  <input
                    type="hidden"
                    name="itemAccessTags"
                    value={JSON.stringify(row.accessTags.length ? row.accessTags : ['public'])}
                  />

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
                          onChange={(e) => {
                            const next = e.target.value as NavLinkType
                            const patch: Partial<EditableItem> = { linkType: next }
                            if (next === 'module' && !row.moduleId && modules[0]) {
                              patch.moduleId = modules[0].moduleId
                              patch.moduleViewKey = modules[0].views[0]?.key ?? ''
                            }
                            updateRow(row.id, patch)
                          }}
                        >
                          <option value="page">CMS page</option>
                          <option value="url">URL</option>
                          <option value="module">Module view</option>
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
                      ) : null}
                      {row.linkType === 'url' ? (
                        <label className="settings-field">
                          <span>URL</span>
                          <input
                            type="text"
                            value={row.url}
                            placeholder="/about or https://…"
                            onChange={(e) => updateRow(row.id, { url: e.target.value })}
                          />
                        </label>
                      ) : null}
                      {row.linkType === 'module' ? (
                        <>
                          <label className="settings-field">
                            <span>Module</span>
                            <select
                              value={row.moduleId}
                              onChange={(e) => {
                                const moduleId = e.target.value
                                const views =
                                  modules.find((m) => m.moduleId === moduleId)?.views ?? []
                                updateRow(row.id, {
                                  moduleId,
                                  moduleViewKey: views[0]?.key ?? '',
                                })
                              }}
                            >
                              <option value="">Select module…</option>
                              {modules.map((m) => (
                                <option key={m.moduleId} value={m.moduleId}>
                                  {m.moduleLabel}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="settings-field">
                            <span>View</span>
                            <select
                              value={row.moduleViewKey}
                              onChange={(e) =>
                                updateRow(row.id, { moduleViewKey: e.target.value })
                              }
                              disabled={!row.moduleId || moduleViews.length === 0}
                            >
                              <option value="">Select view…</option>
                              {moduleViews.map((v) => (
                                <option key={v.key} value={v.key}>
                                  {v.label} ({v.href})
                                </option>
                              ))}
                            </select>
                          </label>
                          {modules.length === 0 ? (
                            <p className="settings-hint">
                              No enabled modules declare navigable views. Turn modules on under Site
                              settings → Modules, or register <code>navViews</code> on a module.
                            </p>
                          ) : null}
                        </>
                      ) : null}
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
                      <AccessTagsField
                        value={row.accessTags}
                        groups={groups}
                        onChange={(accessTags) => updateRow(row.id, { accessTags })}
                      />
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        <div className="nav-items-toolbar admin-action-row">
          {savePending ? <span className="field-hint">Saving…</span> : null}
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
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
          className="outlines-create-form admin-create-form"
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
            <select
              name="newLinkType"
              value={newLinkType}
              onChange={(e) => {
                const next = e.target.value as NavLinkType
                setNewLinkType(next)
                if (next === 'module' && !newModuleId && modules[0]) {
                  setNewModuleId(modules[0].moduleId)
                }
              }}
            >
              <option value="page">CMS page</option>
              <option value="url">URL</option>
              <option value="module">Module view</option>
            </select>
          </label>
          {newLinkType === 'page' ? (
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
          ) : null}
          {newLinkType === 'url' ? (
            <label className="settings-field">
              <span>URL</span>
              <input type="text" name="newUrl" placeholder="/path" />
            </label>
          ) : null}
          {newLinkType === 'module' ? (
            <>
              <label className="settings-field">
                <span>Module</span>
                <select
                  name="newModuleId"
                  value={newModuleId}
                  onChange={(e) => setNewModuleId(e.target.value)}
                >
                  <option value="">Select…</option>
                  {modules.map((m) => (
                    <option key={m.moduleId} value={m.moduleId}>
                      {m.moduleLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>View</span>
                <select
                  name="newModuleViewKey"
                  defaultValue={newModuleViews[0]?.key ?? ''}
                  key={newModuleId}
                >
                  <option value="">Select…</option>
                  {newModuleViews.map((v) => (
                    <option key={v.key} value={v.key}>
                      {v.label} ({v.href})
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={addPending}
          >
            {addPending ? 'Adding…' : 'Add item'}
          </button>
        </form>
      </section>
    </div>
  )
}
