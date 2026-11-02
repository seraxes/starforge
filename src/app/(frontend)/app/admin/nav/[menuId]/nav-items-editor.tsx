'use client'

import React, { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import { GantryBarRemoveButton } from '@/components/admin/GantryBarRemoveButton'
import type { UserGroupOption } from '@/core/acl/types'
import {
  addNavMenuItemAction,
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

function sameIdSet(a: { id: string }[], b: { id: string }[]) {
  if (a.length !== b.length) return false
  const set = new Set(a.map((row) => row.id))
  return b.every((row) => set.has(row.id))
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

type SortableNavItemProps = {
  row: EditableItem
  index: number
  expanded: boolean
  pages: NavPageOption[]
  modules: NavModuleOption[]
  groups: UserGroupOption[]
  parentOptions: { id: string; label: string }[]
  onToggle: () => void
  onPatch: (patch: Partial<EditableItem>) => void
  onCopy: () => void
  onRemove: () => void
  saveNow: () => void
  saveDebounced: () => void
}

function SortableNavItem({
  row,
  index,
  expanded,
  pages,
  modules,
  groups,
  parentOptions,
  onToggle,
  onPatch,
  onCopy,
  onRemove,
  saveNow,
  saveDebounced,
}: SortableNavItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }
  const moduleViews = modules.find((m) => m.moduleId === row.moduleId)?.views ?? []

  return (
    <li ref={setNodeRef} style={style} className="nav-item-row">
      <article
        className={`gantry-slot nav-item-slot${expanded ? ' is-nav-item-open' : ''}${isDragging ? ' is-slot-dragging' : ''}`}
      >
        <header className="gantry-slot-head">
          <div className="gantry-slot-title">
            <button
              type="button"
              className="gantry-slot-handle"
              aria-label={`Drag to reorder item ${index + 1}`}
              {...attributes}
              {...listeners}
            >
              ▣
            </button>
            <button
              type="button"
              className="nav-item-toggle"
              aria-expanded={expanded}
              onClick={onToggle}
            >
              <div className="gantry-slot-labels">
                <strong className="sf-form-slot-name">{row.label || 'Untitled'}</strong>
                <span className="gantry-slot-sub">{summarizeLink(row, pages, modules)}</span>
              </div>
            </button>
          </div>
          <div className="gantry-slot-end">
            <div className="gantry-slot-actions">
              <button
                type="button"
                className="gantry-settings-trigger"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse item settings' : 'Expand item settings'}
                title={expanded ? 'Collapse' : 'Settings'}
                onClick={onToggle}
              >
                ⚙
              </button>
              <GantryBarRemoveButton
                label={`Remove ${row.label || 'item'}`}
                confirmMessage={`Remove nav item “${row.label || 'Untitled'}”?`}
                onConfirm={onRemove}
              />
            </div>
          </div>
        </header>
      </article>

      <input type="hidden" name="itemId" value={row.id} />
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
          <div className="nav-item-body-actions admin-action-row">
            <button type="button" className="gantry-toolbar-btn gantry-toolbar-btn-muted" onClick={onCopy}>
              Copy item
            </button>
          </div>
          <label className="settings-field">
            <span>Label</span>
            <input
              type="text"
              value={row.label}
              onChange={(e) => {
                onPatch({ label: e.target.value })
                saveDebounced()
              }}
              onBlur={saveNow}
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
                onPatch(patch)
                queueMicrotask(saveNow)
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
                onChange={(e) => {
                  onPatch({ pageId: e.target.value })
                  queueMicrotask(saveNow)
                }}
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
                onChange={(e) => {
                  onPatch({ url: e.target.value })
                  saveDebounced()
                }}
                onBlur={saveNow}
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
                    const views = modules.find((m) => m.moduleId === moduleId)?.views ?? []
                    onPatch({
                      moduleId,
                      moduleViewKey: views[0]?.key ?? '',
                    })
                    queueMicrotask(saveNow)
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
                  onChange={(e) => {
                    onPatch({ moduleViewKey: e.target.value })
                    queueMicrotask(saveNow)
                  }}
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
                  No enabled modules declare navigable views. Turn modules on under Site settings →
                  Modules, or register <code>navViews</code> on a module.
                </p>
              ) : null}
            </>
          ) : null}
          <label className="settings-field">
            <span>Parent (optional)</span>
            <select
              value={row.parentId}
              onChange={(e) => {
                onPatch({ parentId: e.target.value })
                queueMicrotask(saveNow)
              }}
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
              onChange={(e) => {
                onPatch({ cssClass: e.target.value })
                saveDebounced()
              }}
              onBlur={saveNow}
            />
          </label>
          <label className="settings-field">
            <span>Browser title override</span>
            <input
              type="text"
              value={row.browserTitle}
              onChange={(e) => {
                onPatch({ browserTitle: e.target.value })
                saveDebounced()
              }}
              onBlur={saveNow}
            />
          </label>
          <label className="settings-field">
            <span>Page heading override</span>
            <input
              type="text"
              value={row.pageHeading}
              onChange={(e) => {
                onPatch({ pageHeading: e.target.value })
                saveDebounced()
              }}
              onBlur={saveNow}
            />
          </label>
          <AccessTagsField
            value={row.accessTags}
            groups={groups}
            onChange={(accessTags) => {
              onPatch({ accessTags })
              queueMicrotask(saveNow)
            }}
          />
        </div>
      ) : null}
    </li>
  )
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
  const [addState, addAction, addPending] = useActionState(addNavMenuItemAction, initial)
  const [pasteState, pasteAction, pastePending] = useActionState(pasteNavMenuItemAction, initial)
  useNotifySavedOnOk(saveState, { toastErrors: true })
  useNotifySavedOnOk(addState, { successMessage: 'Saved', toastErrors: true })
  useNotifySavedOnOk(pasteState, { successMessage: 'Saved', toastErrors: true })
  const { formRef, saveDebounced, saveNow } = useAutosaveForm()

  /**
   * Local draft is source of truth while editing (same class of fix as particle cogs #32).
   * Accept server `items` only when membership changes (add/paste refresh) — never remount
   * drafts from autosave revalidation, which would retrigger save in a loop.
   */
  const menuIdRef = useRef(menuId)
  useEffect(() => {
    if (menuIdRef.current !== menuId) {
      menuIdRef.current = menuId
      setRows(items.map(toEditable))
      setExpandedId(items[0]?.id ?? null)
      return
    }
    setRows((prev) => {
      if (sameIdSet(prev, items)) return prev
      return items.map(toEditable)
    })
  }, [menuId, items])

  // Add/paste create server-side ids — refresh once so membership soft-sync can pick them up.
  const pasteOkRef = useRef(false)
  useEffect(() => {
    if (pasteState.ok && !pasteOkRef.current) {
      pasteOkRef.current = true
      router.refresh()
    }
    if (!pasteState.ok) pasteOkRef.current = false
  }, [pasteState, router])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const parentOptions = useMemo(
    () => rows.map((r) => ({ id: r.id, label: r.label })),
    [rows],
  )

  const newModuleViews = useMemo(
    () => modules.find((m) => m.moduleId === newModuleId)?.views ?? [],
    [modules, newModuleId],
  )

  const sortableIds = useMemo(() => rows.map((r) => r.id), [rows])

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
    if (expandedId === id) setExpandedId(null)
    queueMicrotask(saveNow)
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

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setRows((prev) => {
      const oldIndex = prev.findIndex((row) => row.id === active.id)
      const newIndex = prev.findIndex((row) => row.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
    queueMicrotask(saveNow)
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
      <Feedback state={addState} />
      <Feedback state={pasteState} />

      <form ref={formRef} action={saveAction} className="nav-items-form">
        <input type="hidden" name="menuId" value={menuId} />

        {rows.length === 0 ? (
          <p className="outlines-muted">No items yet — add one below.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <ul className="nav-items-list">
                {rows.map((row, index) => (
                  <SortableNavItem
                    key={row.id}
                    row={row}
                    index={index}
                    expanded={expandedId === row.id}
                    pages={pages}
                    modules={modules}
                    groups={groups}
                    parentOptions={parentOptions}
                    onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    onPatch={(patch) => updateRow(row.id, patch)}
                    onCopy={() => copyRow(row)}
                    onRemove={() => removeRow(row.id)}
                    saveNow={saveNow}
                    saveDebounced={saveDebounced}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
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
