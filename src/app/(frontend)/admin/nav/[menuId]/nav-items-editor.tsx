'use client'

import React, {
  useActionState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
import { LocaleInput } from '@/core/localization/LocaleInput'
import { GantryBarRemoveButton } from '@/components/admin/GantryBarRemoveButton'
import type { UserGroupOption } from '@/core/acl/types'
import type { ContentLocaleOption } from '@/core/i18n/locale-text'
import {
  addNavMenuItemAction,
  pasteNavMenuItemAction,
  saveNavMenuItemsAction,
  type NavActionState,
} from '@/core/nav/actions'
import { navItemCanBeRoot } from '@/core/nav/root-target'
import type { NavLinkType, NavMenuItem, NavModuleOption, NavPageOption } from '@/core/nav/types'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

type OutlineOption = { id: string; label: string }

type EditableItem = {
  id: string
  parentId: string
  label: string
  labels: Record<string, string>
  linkType: NavLinkType
  pageId: string
  url: string
  moduleId: string
  moduleViewKey: string
  cssClass: string
  browserTitle: string
  browserTitles: Record<string, string>
  pageHeading: string
  pageHeadings: Record<string, string>
  /** Layout outline id — synced to Page Settings on save. */
  layoutId: string
  /** Multi-select tags: public | registered | role:admin | group:<id> (OR match). */
  accessTags: string[]
}

type Props = {
  menuId: string
  menuLabel: string
  items: NavMenuItem[]
  pages: NavPageOption[]
  modules: NavModuleOption[]
  groups: UserGroupOption[]
  outlines: OutlineOption[]
  locales: ContentLocaleOption[]
  preferredLayoutId: string
  isSitePrimary: boolean
  /** Item id in this menu that is the site root. Empty when unset or set on another menu. */
  rootItemId: string
  /** Label of the other menu that currently owns the root. */
  rootElsewhere: string | null
  defaultLocaleLabel: string
  localeFallback: boolean
}

const initial: NavActionState = {}

const LINK_TYPES: { value: NavLinkType; label: string }[] = [
  { value: 'page', label: 'CMS page' },
  { value: 'url', label: 'URL' },
  { value: 'module', label: 'Module view' },
  { value: 'admin', label: 'Admin' },
]

function toEditable(item: NavMenuItem, defaultCode: string): EditableItem {
  const tags =
    item.accessTags && item.accessTags.length > 0
      ? [...item.accessTags]
      : item.accessLevel
        ? [String(item.accessLevel)]
        : ['public']

  const linkType: NavLinkType =
    item.linkType === 'admin'
      ? 'admin'
      : item.linkType === 'module'
        ? 'module'
        : item.linkType === 'url'
          ? 'url'
          : 'page'

  const labels = { ...(item.labels ?? {}) }
  if (defaultCode && item.label.trim() && !labels[defaultCode]) {
    labels[defaultCode] = item.label.trim()
  }
  const browserTitles = { ...(item.browserTitles ?? {}) }
  if (defaultCode && item.browserTitle?.trim() && !browserTitles[defaultCode]) {
    browserTitles[defaultCode] = item.browserTitle.trim()
  }
  const pageHeadings = { ...(item.pageHeadings ?? {}) }
  if (defaultCode && item.pageHeading?.trim() && !pageHeadings[defaultCode]) {
    pageHeadings[defaultCode] = item.pageHeading.trim()
  }

  return {
    id: item.id,
    parentId: item.parentId ?? '',
    label: (defaultCode && labels[defaultCode]) || item.label,
    labels,
    linkType,
    pageId: item.pageId != null ? String(item.pageId) : '',
    url: item.url ?? '',
    moduleId: item.moduleId ?? '',
    moduleViewKey: item.moduleViewKey ?? '',
    cssClass: item.cssClass ?? '',
    browserTitle: (defaultCode && browserTitles[defaultCode]) || item.browserTitle || '',
    browserTitles,
    pageHeading: (defaultCode && pageHeadings[defaultCode]) || item.pageHeading || '',
    pageHeadings,
    layoutId: item.layoutId ?? '',
    accessTags: tags,
  }
}

function sameIdSet(a: { id: string }[], b: { id: string }[]) {
  if (a.length !== b.length) return false
  const set = new Set(a.map((row) => row.id))
  return b.every((row) => set.has(row.id))
}

/** Parent select options in tree order; `excludeId` drops that node and its descendants. */
function buildParentTreeOptions(
  rows: { id: string; parentId: string; label: string }[],
  excludeId?: string,
): { id: string; label: string; depth: number }[] {
  const byParent = new Map<string, typeof rows>()
  for (const row of rows) {
    const key = row.parentId && rows.some((r) => r.id === row.parentId) ? row.parentId : ''
    const list = byParent.get(key) ?? []
    list.push(row)
    byParent.set(key, list)
  }

  const out: { id: string; label: string; depth: number }[] = []
  const walk = (parentKey: string, depth: number) => {
    for (const child of byParent.get(parentKey) ?? []) {
      if (excludeId && child.id === excludeId) continue
      out.push({ id: child.id, label: child.label || 'Untitled', depth })
      walk(child.id, depth + 1)
    }
  }
  walk('', 0)
  return out
}

function formatParentTreeLabel(label: string, depth: number) {
  return depth > 0 ? `${'—'.repeat(depth)} ${label}` : label
}

/** Extra dash count after the L corner: depth 1 → none, 2 → one, 3 → two… */
function submenuDepthExtraDashes(depth: number) {
  return depth > 1 ? depth - 1 : 0
}

function buildItemDepthMap(rows: { id: string; parentId: string }[]): Map<string, number> {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const depths = new Map<string, number>()
  const depthOf = (id: string, stack: Set<string>): number => {
    const cached = depths.get(id)
    if (cached !== undefined) return cached
    if (stack.has(id)) return 0
    const row = byId.get(id)
    const parentId = row?.parentId
    if (!parentId || !byId.has(parentId)) {
      depths.set(id, 0)
      return 0
    }
    stack.add(id)
    const depth = depthOf(parentId, stack) + 1
    stack.delete(id)
    depths.set(id, depth)
    return depth
  }
  for (const row of rows) depthOf(row.id, new Set())
  return depths
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

/** Remember which cog was open across save revalidation / remount. */
function expandedStorageKey(menuId: string) {
  return `sf.admin.nav.expanded.${menuId}`
}

function readStoredExpanded(menuId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return sessionStorage.getItem(expandedStorageKey(menuId))
  } catch {
    return null
  }
}

function writeStoredExpanded(menuId: string, id: string | null) {
  if (typeof window === 'undefined') return
  try {
    const key = expandedStorageKey(menuId)
    if (id) sessionStorage.setItem(key, id)
    else sessionStorage.removeItem(key)
  } catch {
    // Private mode / quota — ignore.
  }
}

/** Single draft payload — avoids parallel getAll skew and stale hidden races. */
const ITEMS_JSON_FIELD = 'itemsJson'

function writeItemsJson(form: HTMLFormElement, rows: EditableItem[]) {
  let input = form.querySelector<HTMLInputElement>(`input[name="${ITEMS_JSON_FIELD}"]`)
  if (!input) {
    input = document.createElement('input')
    input.type = 'hidden'
    input.name = ITEMS_JSON_FIELD
    form.appendChild(input)
  }
  input.value = JSON.stringify(
    rows.map((row, index) => ({
      id: row.id,
      parentId: row.parentId || null,
      label: row.label,
      labels: row.labels,
      linkType: row.linkType,
      pageId: row.pageId || null,
      url: row.url || null,
      moduleId: row.moduleId || null,
      moduleViewKey: row.moduleViewKey || null,
      cssClass: row.cssClass || null,
      browserTitle: row.browserTitle || null,
      browserTitles: row.browserTitles,
      pageHeading: row.pageHeading || null,
      pageHeadings: row.pageHeadings,
      layoutId: row.layoutId || null,
      accessTags: row.accessTags.length ? row.accessTags : ['public'],
      sortOrder: index,
    })),
  )
}

function summarizeLink(
  row: EditableItem,
  pages: NavPageOption[],
  modules: NavModuleOption[],
): string {
  if (row.linkType === 'admin') return '/admin'
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
  depth: number
  expanded: boolean
  pages: NavPageOption[]
  modules: NavModuleOption[]
  groups: UserGroupOption[]
  outlines: OutlineOption[]
  locales: ContentLocaleOption[]
  parentOptions: { id: string; label: string; depth: number }[]
  onToggle: () => void
  onPatch: (patch: Partial<EditableItem>) => void
  onCopy: () => void
  onRemove: () => void
  saveNow: () => void
  saveDebounced: () => void
  isRoot: boolean
  canBeRoot: boolean
  onSetRoot: (on: boolean) => void
  defaultLocaleLabel: string
  localeFallback: boolean
}

function SortableNavItem({
  row,
  index,
  depth,
  expanded,
  pages,
  modules,
  groups,
  outlines,
  locales,
  parentOptions,
  onToggle,
  onPatch,
  onCopy,
  onRemove,
  saveNow,
  saveDebounced,
  isRoot,
  canBeRoot,
  onSetRoot,
  defaultLocaleLabel,
  localeFallback,
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
  const extraDashes = submenuDepthExtraDashes(depth)

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
            {depth > 0 ? (
              <span className="nav-item-depth-mark" aria-hidden="true">
                <span className="nav-item-depth-l" />
                {Array.from({ length: extraDashes }, (_, i) => (
                  <span key={i} className="nav-item-depth-dash" />
                ))}
              </span>
            ) : null}
            <button
              type="button"
              className="nav-item-toggle"
              aria-expanded={expanded}
              onClick={onToggle}
            >
              <div className="gantry-slot-labels">
                <strong className="sf-form-slot-name">
                  {row.label || 'Untitled'}
                  {isRoot ? (
                    <>
                      {' '}
                      <span className="outlines-badge">Root</span>
                    </>
                  ) : null}
                </strong>
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

      {expanded ? (
        <div className="nav-item-card-body">
          <div className="admin-settings-mosaic nav-item-mosaic">
            <section className="page-settings-panel">
              <header className="page-settings-panel-head">
                <h3>Menu</h3>
              </header>
              <div className="page-settings-panel-body">
                <LocaleInput
                  locales={locales}
                  values={row.labels}
                  label="Label"
                  requiredDefault
                  onChange={(code, value) => {
                    const labels = { ...row.labels, [code]: value }
                    const isDefault = locales.find((locale) => locale.code === code)?.isDefault
                    onPatch(isDefault ? { labels, label: value } : { labels })
                    saveDebounced()
                  }}
                  onBlur={saveNow}
                />
                <label className="settings-field">
                  <span>Parent</span>
                  <select
                    value={row.parentId}
                    onChange={(e) => {
                      onPatch({ parentId: e.target.value })
                      queueMicrotask(saveNow)
                    }}
                  >
                    <option value="">Top level</option>
                    {parentOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {formatParentTreeLabel(p.label, p.depth)}
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
              </div>
            </section>

            <section className="page-settings-panel">
              <header className="page-settings-panel-head">
                <h3>Link</h3>
              </header>
              <div className="page-settings-panel-body">
                <label className="settings-field">
                  <span>Link type</span>
                  <select
                    value={row.linkType}
                    onChange={(e) => {
                      const next = e.target.value as NavLinkType
                      // Layout outline stays frozen — only the Layout select changes it.
                      const patch: Partial<EditableItem> = { linkType: next }
                      if (next === 'module' && !row.moduleId && modules[0]) {
                        patch.moduleId = modules[0].moduleId
                        patch.moduleViewKey = modules[0].views[0]?.key ?? ''
                      }
                      if (next === 'admin') {
                        if (isRoot) onSetRoot(false)
                      }
                      onPatch(patch)
                      queueMicrotask(saveNow)
                    }}
                  >
                    {LINK_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {row.linkType === 'admin' ? (
                  <p className="settings-hint">
                    Links to <code>/admin</code> without a locale prefix. Pick Admin role and/or a
                    group under Who can see. Admin links cannot be the site root.
                  </p>
                ) : null}
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
                        const url = e.target.value
                        onPatch({ url })
                        if (isRoot && !navItemCanBeRoot({ linkType: 'url', url })) onSetRoot(false)
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
                        No enabled modules declare navigable views. Turn modules on under Settings
                        → Modules, or register <code>navViews</code> on a module.
                      </p>
                    ) : null}
                  </>
                ) : null}
                {row.linkType !== 'admin' ? (
                  <label className="settings-flag">
                    <input
                      type="checkbox"
                      checked={isRoot}
                      disabled={!canBeRoot}
                      onChange={(e) => onSetRoot(e.target.checked)}
                    />
                    <span>
                      <strong>Root</strong>
                      <span className="settings-flag-desc">
                        {canBeRoot
                          ? 'Visitors at /{locale} see this item in that language.'
                          : 'External URLs cannot be the site root. Use an internal path.'}
                      </span>
                    </span>
                  </label>
                ) : null}
                {row.linkType !== 'admin' && canBeRoot ? (
                  <p className="settings-hint">
                    {localeFallback ? (
                      <>Missing fields use {defaultLocaleLabel}. </>
                    ) : (
                      <>Fallback is off, so a missing field stays empty. </>
                    )}
                    <Link href="/admin/localization">Localization</Link>
                  </p>
                ) : null}
              </div>
            </section>

            {row.linkType !== 'admin' ? (
              <section className="page-settings-panel">
                <header className="page-settings-panel-head">
                  <h3>Page</h3>
                </header>
                <div className="page-settings-panel-body">
                  <label className="settings-field">
                    <span>Layout outline</span>
                    <select
                      value={row.layoutId}
                      onChange={(e) => {
                        onPatch({ layoutId: e.target.value })
                        queueMicrotask(saveNow)
                      }}
                    >
                      <option value="">Site default (no page override)</option>
                      {outlines.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label} ({o.id})
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="settings-hint">
                    Same assignment as Layouts →{' '}
                    <Link
                      href={
                        row.layoutId
                          ? `/admin/assigned-menu?outline=${encodeURIComponent(row.layoutId)}`
                          : '/admin/assigned-menu'
                      }
                    >
                      Assigned Menu
                    </Link>
                    .
                  </p>
                  <LocaleInput
                    locales={locales}
                    values={row.browserTitles}
                    label="Browser title override"
                    onChange={(code, value) => {
                      const browserTitles = { ...row.browserTitles, [code]: value }
                      const isDefault = locales.find((locale) => locale.code === code)?.isDefault
                      onPatch(
                        isDefault ? { browserTitles, browserTitle: value } : { browserTitles },
                      )
                      saveDebounced()
                    }}
                    onBlur={saveNow}
                  />
                  <LocaleInput
                    locales={locales}
                    values={row.pageHeadings}
                    label="Page heading override"
                    onChange={(code, value) => {
                      const pageHeadings = { ...row.pageHeadings, [code]: value }
                      const isDefault = locales.find((locale) => locale.code === code)?.isDefault
                      onPatch(isDefault ? { pageHeadings, pageHeading: value } : { pageHeadings })
                      saveDebounced()
                    }}
                    onBlur={saveNow}
                  />
                </div>
              </section>
            ) : null}

            <section className="page-settings-panel page-settings-panel-wide">
              <header className="page-settings-panel-head">
                <h3>Who can see</h3>
              </header>
              <div className="page-settings-panel-body">
                <AccessTagsField
                  value={row.accessTags}
                  groups={groups}
                  allowEmpty={row.linkType === 'admin'}
                  legend="Who can see"
                  className="nav-item-access"
                  onChange={(accessTags) => {
                    onPatch({ accessTags })
                    queueMicrotask(saveNow)
                  }}
                />
              </div>
            </section>
          </div>
          <div className="page-settings-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              onClick={onCopy}
            >
              Copy item
            </button>
          </div>
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
  outlines,
  locales,
  preferredLayoutId,
  isSitePrimary,
  rootItemId: rootItemIdProp,
  rootElsewhere,
  defaultLocaleLabel,
  localeFallback,
}: Props) {
  const router = useRouter()
  const defaultCode = locales.find((locale) => locale.isDefault)?.code ?? locales[0]?.code ?? ''
  const [rows, setRows] = useState<EditableItem[]>(() =>
    items.map((item) => toEditable(item, defaultCode)),
  )
  /**
   * Intentional draft — updated only in commit paths, never from a passive rows sync.
   * Autosave reads this so link-type/module changes are not lost to stale hidden inputs
   * or useActionState transition rollback after save.
   */
  const rowsRef = useRef<EditableItem[]>(rows)
  const [clipboard, setClipboard] = useState<string>('')
  // Null until sessionStorage hydrate — never default to items[0] (that jumped after save remounts).
  const [expandedId, setExpandedIdState] = useState<string | null>(null)
  const expandedIdRef = useRef<string | null>(null)
  const scrollYOnSaveRef = useRef<number | null>(null)

  const setExpandedId = (id: string | null) => {
    expandedIdRef.current = id
    setExpandedIdState(id)
    writeStoredExpanded(menuId, id)
  }

  const [addOpen, setAddOpen] = useState(false)
  const [addFormKey, setAddFormKey] = useState(0)
  const [newLinkType, setNewLinkType] = useState<NavLinkType>('page')
  const [newModuleId, setNewModuleId] = useState(modules[0]?.moduleId ?? '')
  const [newParentId, setNewParentId] = useState('')
  const [newLayoutId, setNewLayoutId] = useState(preferredLayoutId)
  const [newAccessTags, setNewAccessTags] = useState<string[]>([])
  const [rootItemId, setRootItemId] = useState(rootItemIdProp)
  const rootItemIdRef = useRef(rootItemIdProp)
  const rootInputRef = useRef<HTMLInputElement>(null)

  const setRoot = (id: string) => {
    rootItemIdRef.current = id
    setRootItemId(id)
    if (rootInputRef.current) rootInputRef.current.value = id
    queueMicrotask(saveNow)
  }

  const [saveState, saveAction, savePending] = useActionState(saveNavMenuItemsAction, initial)
  const [addState, addAction, addPending] = useActionState(addNavMenuItemAction, initial)
  const [pasteState, pasteAction, pastePending] = useActionState(pasteNavMenuItemAction, initial)
  useNotifySavedOnOk(saveState, { toastErrors: true })
  useNotifySavedOnOk(addState, { successMessage: 'Saved', toastErrors: true })
  useNotifySavedOnOk(pasteState, { successMessage: 'Saved', toastErrors: true })
  const { formRef, saveDebounced: saveDebouncedRaw, saveNow: saveNowRaw } = useAutosaveForm()
  /** Queue a follow-up save when edits arrive while an action is still pending. */
  const resaveAfterPendingRef = useRef(false)
  const savePendingLiveRef = useRef(false)

  const saveNow = () => {
    if (savePendingLiveRef.current) {
      resaveAfterPendingRef.current = true
      return
    }
    saveNowRaw()
  }

  const saveDebounced = () => {
    if (savePendingLiveRef.current) {
      resaveAfterPendingRef.current = true
      return
    }
    saveDebouncedRaw()
  }

  const addOkRef = useRef(false)
  useEffect(() => {
    if (addState.ok && !addOkRef.current) {
      addOkRef.current = true
      setAddOpen(false)
      setAddFormKey((k) => k + 1)
      setNewLinkType('page')
      setNewModuleId(modules[0]?.moduleId ?? '')
      setNewParentId('')
      setNewLayoutId(preferredLayoutId)
      setNewAccessTags([])
      router.refresh()
    }
    if (!addState.ok) addOkRef.current = false
  }, [addState, modules, preferredLayoutId, router])

  useEffect(() => {
    if (addState.error) setAddOpen(true)
  }, [addState.error])

  const commitRows = (updater: (prev: EditableItem[]) => EditableItem[]) => {
    // Sync ref immediately so queueMicrotask(saveNow) / onSubmit see the draft
    // before React flushes (link type + module were jumping back after autosave).
    const next = updater(rowsRef.current)
    rowsRef.current = next
    setRows(next)
  }

  /**
   * Local draft is source of truth while editing (same class of fix as particle cogs #32).
   * Accept server `items` only when membership changes (add/paste refresh) — never remount
   * drafts from autosave revalidation, which would retrigger save in a loop.
   */
  const menuIdRef = useRef(menuId)
  useEffect(() => {
    if (menuIdRef.current !== menuId) {
      menuIdRef.current = menuId
      const next = items.map((item) => toEditable(item, defaultCode))
      rowsRef.current = next
      setRows(next)
      return
    }
    setRows((prev) => {
      if (sameIdSet(prev, items)) return prev
      const next = items.map((item) => toEditable(item, defaultCode))
      rowsRef.current = next
      // Keep the open cog if that item still exists — never jump to another row.
      if (expandedIdRef.current && !next.some((row) => row.id === expandedIdRef.current)) {
        expandedIdRef.current = null
        setExpandedIdState(null)
        writeStoredExpanded(menuId, null)
      }
      return next
    })
  }, [menuId, items, defaultCode])

  // Restore open cog per menu (survives save revalidation remounts).
  useLayoutEffect(() => {
    const stored = readStoredExpanded(menuId)
    const valid =
      stored && rowsRef.current.some((row) => row.id === stored) ? stored : null
    expandedIdRef.current = valid
    setExpandedIdState(valid)
  }, [menuId])

  // useActionState transitions can roll controlled selects back mid-save.
  // Keep the intentional draft + open cog + scroll for the whole pending window.
  useLayoutEffect(() => {
    savePendingLiveRef.current = savePending
    if (savePending) {
      if (scrollYOnSaveRef.current == null) scrollYOnSaveRef.current = window.scrollY
      setRows(rowsRef.current)
      if (expandedIdRef.current !== null) setExpandedIdState(expandedIdRef.current)
      return
    }
    setRows(rowsRef.current)
    if (expandedIdRef.current !== null) setExpandedIdState(expandedIdRef.current)
    const y = scrollYOnSaveRef.current
    scrollYOnSaveRef.current = null
    if (y != null) window.scrollTo(0, y)
    if (resaveAfterPendingRef.current) {
      resaveAfterPendingRef.current = false
      queueMicrotask(() => saveNowRaw())
    }
  }, [savePending, saveNowRaw])

  // While pending, also re-snap if React rolled `rows` / expanded away from the draft.
  useLayoutEffect(() => {
    if (!savePending) return
    if (rows !== rowsRef.current) setRows(rowsRef.current)
    if (expandedId !== expandedIdRef.current) setExpandedIdState(expandedIdRef.current)
  }, [savePending, rows, expandedId])

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

  const parentTreeOptions = useMemo(() => buildParentTreeOptions(rows), [rows])
  const itemDepthById = useMemo(() => buildItemDepthMap(rows), [rows])

  const newModuleViews = useMemo(
    () => modules.find((m) => m.moduleId === newModuleId)?.views ?? [],
    [modules, newModuleId],
  )

  const sortableIds = useMemo(() => rows.map((r) => r.id), [rows])

  const updateRow = (id: string, patch: Partial<EditableItem>) => {
    commitRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeRow = (id: string) => {
    commitRows((prev) =>
      prev
        .filter((row) => row.id !== id)
        .map((row) => (row.parentId === id ? { ...row, parentId: '' } : row)),
    )
    if (rootItemIdRef.current === id) setRoot('')
    if (expandedId === id) setExpandedId(null)
    queueMicrotask(saveNow)
  }

  const copyRow = (row: EditableItem) => {
    const payload = {
      label: row.label,
      linkType: row.linkType,
      pageId: row.pageId || null,
      url: row.url,
      moduleId: row.moduleId || null,
      moduleViewKey: row.moduleViewKey || null,
      parentId: null,
      cssClass: row.cssClass || null,
      browserTitle: row.browserTitle || null,
      browserTitles: row.browserTitles,
      pageHeading: row.pageHeading || null,
      pageHeadings: row.pageHeadings,
      labels: row.labels,
      layoutId: row.layoutId || null,
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
    commitRows((prev) => {
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
        · <Link href="/admin/nav">All menus</Link>
        {rootItemId ? null : rootElsewhere ? (
          <>
            {' '}
            · Root is set on <strong>{rootElsewhere}</strong>.
          </>
        ) : (
          <>
            {' '}
            · <code>/{'{locale}'}</code> is still the page slug <code>home</code>.
          </>
        )}
      </p>

      <Feedback state={saveState} />
      <Feedback state={addState} />
      <Feedback state={pasteState} />

      <section className="outlines-create sf-events-add-panel nav-items-add" aria-label="Add menu item">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${addOpen ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={addOpen}
            aria-controls="nav-items-add-form"
            onClick={() => {
              if (addOpen) {
                setAddOpen(false)
                setAddFormKey((k) => k + 1)
              } else {
                setAddOpen(true)
              }
            }}
          >
            {addOpen ? 'Close' : 'Add +'}
          </button>
          {!addOpen ? (
            <p className="settings-hint sf-events-add-hint">
              Click Add + to create a menu item — pick parent in the tree when nesting.
            </p>
          ) : null}
        </div>

        {addOpen ? (
          <form
            key={addFormKey}
            id="nav-items-add-form"
            action={addAction}
            className="outlines-create-form admin-create-form nav-items-add-form"
            onSubmit={(e) => {
              writeItemsJson(e.currentTarget, rowsRef.current)
            }}
          >
            <input type="hidden" name="menuId" value={menuId} />
            <label className="settings-field">
              <span>Label</span>
              <input type="text" name="newLabel" placeholder="About" required maxLength={120} />
            </label>
            <label className="settings-field">
              <span>Parent</span>
              <select
                name="newParentId"
                value={newParentId}
                onChange={(e) => setNewParentId(e.target.value)}
              >
                <option value="">Top level</option>
                {parentTreeOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {formatParentTreeLabel(p.label, p.depth)}
                  </option>
                ))}
              </select>
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
                {LINK_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
            {newLinkType !== 'admin' ? (
              <label className="settings-field">
                <span>Layout outline</span>
                <select
                  name="newLayoutId"
                  value={newLayoutId}
                  onChange={(e) => setNewLayoutId(e.target.value)}
                >
                  {outlines.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label} ({o.id})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {newLinkType === 'admin' ? (
              <div className="nav-items-add-span">
                <p className="settings-hint">
                  Links to <code>/admin</code> without a locale prefix. Pick Admin role and/or a
                  group below.
                </p>
                <AccessTagsField
                  value={newAccessTags}
                  groups={groups}
                  onChange={setNewAccessTags}
                  allowEmpty
                />
                <input type="hidden" name="newAccessTags" value={JSON.stringify(newAccessTags)} />
              </div>
            ) : null}
            {newLinkType === 'module' && modules.length === 0 ? (
              <p className="settings-hint nav-items-add-span">
                No enabled modules declare navigable views. Turn modules on under Settings → Modules,
                or register <code>navViews</code> on a module.
              </p>
            ) : null}
            <div className="page-settings-actions nav-items-add-span">
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={addPending}
                onClick={() => {
                  setAddOpen(false)
                  setAddFormKey((k) => k + 1)
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={addPending}
              >
                {addPending ? 'Adding…' : 'Add item'}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {/*
        Item editors stay OUTSIDE the useActionState form. React form-action
        transitions were rolling every Link type / layout select back to defaults
        on save even though itemsJson persisted correctly (reload looked fine).
      */}
      {rows.length === 0 ? (
        <p className="outlines-muted">No items yet — use Add + above.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <ul className="nav-items-list">
              {rows.map((row, index) => (
                <SortableNavItem
                  key={row.id}
                  row={row}
                  index={index}
                  depth={itemDepthById.get(row.id) ?? 0}
                  expanded={expandedId === row.id}
                  pages={pages}
                  modules={modules}
                  groups={groups}
                  outlines={outlines}
                  locales={locales}
                  parentOptions={buildParentTreeOptions(rows, row.id)}
                  onToggle={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  onPatch={(patch) => updateRow(row.id, patch)}
                  onCopy={() => copyRow(row)}
                  onRemove={() => removeRow(row.id)}
                  saveNow={saveNow}
                  saveDebounced={saveDebounced}
                  isRoot={rootItemId === row.id}
                  canBeRoot={navItemCanBeRoot({ linkType: row.linkType, url: row.url })}
                  onSetRoot={(on) => setRoot(on ? row.id : '')}
                  defaultLocaleLabel={defaultLocaleLabel}
                  localeFallback={localeFallback}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <form
        ref={formRef}
        action={saveAction}
        className="nav-items-form"
        onSubmit={(e) => {
          writeItemsJson(e.currentTarget, rowsRef.current)
        }}
      >
        <input type="hidden" name="menuId" value={menuId} />
        <input ref={rootInputRef} type="hidden" name="rootItemId" value={rootItemId} />
      </form>

      <div className="nav-items-toolbar admin-action-row">
        {savePending ? <span className="field-hint">Saving…</span> : null}
        <form
          action={pasteAction}
          className="nav-items-paste-form"
          onSubmit={(e) => {
            writeItemsJson(e.currentTarget, rowsRef.current)
            let clip = e.currentTarget.querySelector<HTMLInputElement>('input[name="clipboardJson"]')
            if (!clip) {
              clip = document.createElement('input')
              clip.type = 'hidden'
              clip.name = 'clipboardJson'
              e.currentTarget.appendChild(clip)
            }
            clip.value = clipboard
          }}
        >
          <input type="hidden" name="menuId" value={menuId} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={pastePending || !clipboard}
          >
            Paste item
          </button>
        </form>
      </div>
    </div>
  )
}
