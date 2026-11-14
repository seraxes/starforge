'use client'

import React, { useActionState, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { useAdminToast } from '@/app/(frontend)/admin/admin-toast'
import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'
import {
  analyzeMediaAction,
  applyMediaAnalysisSuggestionsAction,
  bulkDeleteMediaAction,
  bulkUpdateMediaAction,
  createMediaCategoryAction,
  deleteMediaAction,
  deleteMediaCategoryAction,
  renameMediaCategoryAction,
  uploadMediaAction,
  type MediaActionState,
  type ResolvedMedia,
} from '@/core/media/actions'
import {
  findCategoryInTree,
  flattenCategoryOptions,
  type MediaCategoryNode,
} from '@/core/media/categories'
import {
  parseMediaTagFilter,
  serializeMediaTagFilter,
  type MediaSuggestionPatch,
  type MediaTagMatchMode,
} from '@/core/media/library-query'
import { MEDIA_PURPOSES } from '@/core/media/pipeline'
import type { MediaTagOption } from '@/core/media/resolve'
import type { MediaStorageInfo } from '@/core/media/storage'

import { MediaCategoryTree } from './MediaCategoryTree'
import { MediaFileField } from './MediaFileField'
import { MediaLightbox } from './MediaLightbox'

const empty: MediaActionState = {}

export type MediaLibraryView = 'mosaic' | 'list'

type Props = {
  initialDocs: ResolvedMedia[]
  totalDocs: number
  storage: MediaStorageInfo
  category: string
  purpose: string
  tag: string
  tagMode: MediaTagMatchMode
  q: string
  view: MediaLibraryView
  tagOptions: MediaTagOption[]
  categoryTree: MediaCategoryNode[]
  /** Registered MediaAnalysisPort adapter ids (stub usage; empty hooks = no auto-run). */
  analysisAdapters: string[]
  /** Max edge from Media → Settings (hint on upload). */
  maxEdge: number
}

function libraryHref(next: {
  category?: string
  purpose?: string
  tag?: string
  tagMode?: MediaTagMatchMode
  q?: string
  view?: MediaLibraryView
}): string {
  const params = new URLSearchParams()
  const c = next.category ?? 'all'
  const p = next.purpose ?? 'all'
  const tagFilter = parseMediaTagFilter(next.tag, next.tagMode)
  const serialized = serializeMediaTagFilter(tagFilter)
  const query = next.q ?? ''
  const view = next.view ?? 'mosaic'
  if (c && c !== 'all') params.set('category', c)
  if (p && p !== 'all') params.set('purpose', p)
  if (serialized.tag) params.set('tag', serialized.tag)
  if (serialized.tagMode) params.set('tagMode', serialized.tagMode)
  if (query.trim()) params.set('q', query.trim())
  if (view && view !== 'mosaic') params.set('view', view)
  const qs = params.toString()
  return qs ? `/admin/media?${qs}` : '/admin/media'
}

export function MediaLibraryClient({
  initialDocs,
  totalDocs,
  storage,
  category,
  purpose,
  tag,
  tagMode,
  q,
  view,
  tagOptions,
  categoryTree,
  analysisAdapters,
  maxEdge,
}: Props) {
  const router = useRouter()
  const { notifySaved } = useAdminToast()
  const [uploadState, uploadAction, uploading] = useActionState(uploadMediaAction, empty)
  const [deleteState, deleteAction, deleting] = useActionState(deleteMediaAction, empty)
  const [bulkDeleteState, bulkDeleteAction, bulkDeleting] = useActionState(
    bulkDeleteMediaAction,
    empty,
  )
  const [bulkUpdateState, bulkUpdateAction, bulkUpdating] = useActionState(
    bulkUpdateMediaAction,
    empty,
  )
  const [analyzeState, analyzeAction, analyzing] = useActionState(analyzeMediaAction, empty)
  const [applySuggestState, applySuggestAction, applyingSuggest] = useActionState(
    applyMediaAnalysisSuggestionsAction,
    empty,
  )
  const [createCatState, createCatAction, creatingCat] = useActionState(
    createMediaCategoryAction,
    empty,
  )
  const [renameCatState, renameCatAction, renamingCat] = useActionState(
    renameMediaCategoryAction,
    empty,
  )
  const [deleteCatState, deleteCatAction, deletingCat] = useActionState(
    deleteMediaCategoryAction,
    empty,
  )
  const [pending, startTransition] = useTransition()

  const [purposeDraft, setPurposeDraft] = useState(purpose)
  const [tagDraft, setTagDraft] = useState(tag === 'all' ? '' : tag)
  const [tagModeDraft, setTagModeDraft] = useState<MediaTagMatchMode>(tagMode)
  const [qDraft, setQDraft] = useState(q)
  const [uploadHint, setUploadHint] = useState<string | null>(null)
  const [uploadCategory, setUploadCategory] = useState(category !== 'all' ? category : '')
  const [uploadPurpose, setUploadPurpose] = useState('photo')
  const [uploadTag, setUploadTag] = useState(() => {
    const ids = parseMediaTagFilter(tag).ids
    return ids[0] ?? ''
  })
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkTag, setBulkTag] = useState('')
  const [suggestions, setSuggestions] = useState<MediaSuggestionPatch | null>(null)
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null)
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)

  const busy =
    uploading ||
    deleting ||
    pending ||
    creatingCat ||
    renamingCat ||
    deletingCat ||
    bulkDeleting ||
    bulkUpdating ||
    analyzing ||
    applyingSuggest
  const categoryOptions = useMemo(() => flattenCategoryOptions(categoryTree), [categoryTree])
  const selectedIds = useMemo(() => [...selected], [selected])

  // Keep drafts in sync when URL filters change (Clear / chip / folder / back).
  React.useEffect(() => {
    setPurposeDraft(purpose)
    setTagDraft(tag === 'all' ? '' : tag)
    setTagModeDraft(tagMode)
    setQDraft(q)
    if (category !== 'all') setUploadCategory(category)
    const ids = parseMediaTagFilter(tag).ids
    if (ids[0]) setUploadTag(ids[0])
  }, [category, purpose, tag, tagMode, q])

  React.useEffect(() => {
    if (uploadState.ok) {
      setUploadHint(null)
      notifySaved(uploadState.message || 'Uploaded.')
      startTransition(() => router.refresh())
    }
  }, [uploadState, router, notifySaved])

  React.useEffect(() => {
    if (deleteState.ok) {
      notifySaved(deleteState.message || 'Deleted.')
      setLightboxIndex(null)
      startTransition(() => router.refresh())
    }
  }, [deleteState, router, notifySaved])

  React.useEffect(() => {
    const state = bulkDeleteState.ok
      ? bulkDeleteState
      : bulkUpdateState.ok
        ? bulkUpdateState
        : null
    if (!state?.ok) return
    notifySaved(state.message || 'Saved.')
    setSelected(new Set())
    startTransition(() => router.refresh())
  }, [bulkDeleteState, bulkUpdateState, router, notifySaved])

  React.useEffect(() => {
    const state = createCatState.ok
      ? createCatState
      : renameCatState.ok
        ? renameCatState
        : deleteCatState.ok
          ? deleteCatState
          : null
    if (!state?.ok) return
    notifySaved(state.message || 'Saved.')
    startTransition(() => router.refresh())
  }, [createCatState, renameCatState, deleteCatState, router, notifySaved])

  React.useEffect(() => {
    if (!analyzeState.ok && !analyzeState.error) return
    if (analyzeState.error) {
      setAnalysisMessage(null)
      return
    }
    setAnalysisMessage(analyzeState.message || 'Analysis complete.')
    setSuggestions(analyzeState.suggestions ?? null)
  }, [analyzeState])

  React.useEffect(() => {
    if (applySuggestState.ok) {
      notifySaved(applySuggestState.message || 'Suggestions applied.')
      setSuggestions(null)
      setAnalysisMessage(null)
      startTransition(() => router.refresh())
    }
  }, [applySuggestState, router, notifySaved])

  // Drop lightbox if the filtered set no longer contains the open index.
  React.useEffect(() => {
    if (lightboxIndex == null) return
    if (initialDocs.length === 0) {
      setLightboxIndex(null)
      return
    }
    if (lightboxIndex >= initialDocs.length) {
      setLightboxIndex(initialDocs.length - 1)
    }
  }, [initialDocs, lightboxIndex])

  // Drop selection for ids that left the current page.
  React.useEffect(() => {
    const visible = new Set(initialDocs.map((d) => d.id))
    setSelected((prev) => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visible.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [initialDocs])

  const filterHref = useMemo(
    () =>
      libraryHref({
        category,
        purpose: purposeDraft,
        tag: tagDraft || 'all',
        tagMode: tagModeDraft,
        q: qDraft,
        view,
      }),
    [category, purposeDraft, tagDraft, tagModeDraft, qDraft, view],
  )

  const activeTagIds = parseMediaTagFilter(tag === 'all' ? '' : tag, tagMode).ids
  const filtersActive =
    (purpose && purpose !== 'all') ||
    activeTagIds.length > 0 ||
    Boolean(q.trim())

  const activeCategory = category !== 'all' ? findCategoryInTree(categoryTree, category) : null
  const activeFolderLabel = activeCategory?.path || activeCategory?.title || 'All media'

  function pushFilter(next: {
    category?: string
    purpose?: string
    tag?: string
    tagMode?: MediaTagMatchMode
    q?: string
    view?: MediaLibraryView
  }) {
    const href = libraryHref({
      category: next.category ?? category,
      purpose: next.purpose ?? purposeDraft,
      tag: next.tag ?? (tagDraft || 'all'),
      tagMode: next.tagMode ?? tagModeDraft,
      q: next.q ?? qDraft,
      view: next.view ?? view,
    })
    startTransition(() => router.push(href))
  }

  function selectCategory(nextCategory: string) {
    if (nextCategory !== 'all') setUploadCategory(nextCategory)
    pushFilter({ category: nextCategory })
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    setSelected(new Set(initialDocs.map((d) => d.id)))
  }

  function clearSelection() {
    setSelected(new Set())
  }

  function requestDelete(id: string) {
    const fd = new FormData()
    fd.set('id', id)
    startTransition(() => {
      void deleteAction(fd)
    })
  }

  function requestAnalyze(id: string) {
    setSuggestions(null)
    setAnalysisMessage(null)
    const fd = new FormData()
    fd.set('id', id)
    startTransition(() => {
      void analyzeAction(fd)
    })
  }

  function requestApplySuggestions(id: string, patch: MediaSuggestionPatch) {
    const fd = new FormData()
    fd.set('id', id)
    if (patch.alt) fd.set('alt', patch.alt)
    if (patch.purpose) fd.set('purpose', patch.purpose)
    if (patch.categoryId) fd.set('categoryId', patch.categoryId)
    if (patch.tagIds?.length) fd.set('tagIds', patch.tagIds.join(','))
    startTransition(() => {
      void applySuggestAction(fd)
    })
  }

  function requestBulkDelete() {
    if (!selectedIds.length) return
    setBulkDeleteConfirmOpen(true)
  }

  function confirmBulkDelete() {
    if (!selectedIds.length) return
    setBulkDeleteConfirmOpen(false)
    const fd = new FormData()
    fd.set('idsCsv', selectedIds.join(','))
    startTransition(() => {
      void bulkDeleteAction(fd)
    })
  }

  function runBulkUpdate() {
    if (!selectedIds.length) return
    if (!bulkCategory && !bulkTag) return
    const fd = new FormData()
    fd.set('idsCsv', selectedIds.join(','))
    if (bulkCategory) fd.set('category', bulkCategory)
    if (bulkTag) fd.set('tag', bulkTag)
    startTransition(() => {
      void bulkUpdateAction(fd)
    })
  }

  function runCategoryAction(
    action: (fd: FormData) => void,
    fields: Record<string, string>,
  ) {
    const fd = new FormData()
    for (const [k, v] of Object.entries(fields)) fd.set(k, v)
    startTransition(() => {
      void action(fd)
    })
  }

  function toggleTagFilter(tagId: string) {
    const current = parseMediaTagFilter(tagDraft || tag, tagModeDraft)
    const nextIds = current.ids.includes(tagId)
      ? current.ids.filter((id) => id !== tagId)
      : [...current.ids, tagId]
    const next = serializeMediaTagFilter({ ids: nextIds, mode: tagModeDraft })
    setTagDraft(next.tag ?? '')
    pushFilter({ tag: next.tag ?? 'all', tagMode: tagModeDraft })
  }

  const catError =
    createCatState.error || renameCatState.error || deleteCatState.error || null
  const bulkError = bulkDeleteState.error || bulkUpdateState.error || null

  return (
    <div className="sf-media-library">
      <div className="sf-media-library-status">
        <p>
          Storage: <strong>{storage.label}</strong>
          {storage.ready ? ' (ready)' : ' (not ready)'}
          {storage.detail ? <span className="layout-muted"> — {storage.detail}</span> : null}
        </p>
        {!storage.ready ? (
          <p className="layout-muted" role="status">
            Configure <code>STARFORGE_MEDIA_STORAGE</code> / <code>S3_*</code> in{' '}
            <Link href="/admin/site-chrome/environment">Chrome → Environment</Link> (or{' '}
            <code>.env</code>). Incomplete <code>s3</code> never falls back to local disk.
          </p>
        ) : null}
        <p className="layout-muted">
          Analysis port: {analysisAdapters.length ? analysisAdapters.join(', ') : 'none'} (Analyze
          in lightbox runs adapters explicitly — never auto). {totalDocs} item
          {totalDocs === 1 ? '' : 's'} in <strong>{activeFolderLabel}</strong>. Pipeline rules:{' '}
          <Link href="/admin/media/settings">Media → Settings</Link>. Payload CMS Media remains
          the store — <Link href="/cms/admin/collections/media">open in CMS</Link>.
        </p>
      </div>

      <div className="sf-media-library-layout">
        <MediaCategoryTree
          tree={categoryTree}
          activeId={category}
          busy={busy}
          onSelect={selectCategory}
          onCreate={({ title, parentId }) =>
            runCategoryAction(createCatAction, {
              title,
              parentId: parentId || '',
            })
          }
          onRename={({ id, title }) => runCategoryAction(renameCatAction, { id, title })}
          onDelete={(id) => {
            runCategoryAction(deleteCatAction, { id })
            if (category === id) selectCategory('all')
          }}
        />

        <div className="sf-media-library-main">
          <div className="admin-settings-mosaic">
            <form
              className="sf-media-library-filters"
              onSubmit={(e) => {
                e.preventDefault()
                startTransition(() => router.push(filterHref))
              }}
            >
              <div className="sf-media-library-toolbar">
                <h3 className="admin-settings-panel-title">Filter</h3>
                <div
                  className="sf-media-view-toggle"
                  role="group"
                  aria-label="Library view"
                >
                  <button
                    type="button"
                    className={`gantry-toolbar-btn gantry-toolbar-btn-muted${view === 'mosaic' ? ' is-active' : ''}`}
                    disabled={busy || view === 'mosaic'}
                    aria-pressed={view === 'mosaic'}
                    onClick={() => pushFilter({ view: 'mosaic' })}
                  >
                    Mosaic
                  </button>
                  <button
                    type="button"
                    className={`gantry-toolbar-btn gantry-toolbar-btn-muted${view === 'list' ? ' is-active' : ''}`}
                    disabled={busy || view === 'list'}
                    aria-pressed={view === 'list'}
                    onClick={() => pushFilter({ view: 'list' })}
                  >
                    List
                  </button>
                </div>
              </div>
              <p className="layout-muted">
                Browsing <strong>{activeFolderLabel}</strong>
                {category !== 'all' ? (
                  <>
                    {' '}
                    —{' '}
                    <button
                      type="button"
                      className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                      disabled={busy}
                      onClick={() => selectCategory('all')}
                    >
                      Show all folders
                    </button>
                  </>
                ) : null}
                . Purpose chips + tag AND/OR refine within the folder.
              </p>

              <div className="sf-media-purpose-chips" role="group" aria-label="Purpose">
                <button
                  type="button"
                  className={`sf-media-chip${purposeDraft === 'all' || !purposeDraft ? ' is-active' : ''}`}
                  disabled={busy}
                  aria-pressed={purposeDraft === 'all' || !purposeDraft}
                  onClick={() => {
                    setPurposeDraft('all')
                    pushFilter({ purpose: 'all' })
                  }}
                >
                  All purposes
                </button>
                {MEDIA_PURPOSES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`sf-media-chip${purposeDraft === p.value ? ' is-active' : ''}`}
                    disabled={busy}
                    aria-pressed={purposeDraft === p.value}
                    onClick={() => {
                      setPurposeDraft(p.value)
                      pushFilter({ purpose: p.value })
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="sf-media-library-filters-row">
                <label>
                  <span>Tags</span>
                  <select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value
                      if (id) toggleTagFilter(id)
                      e.target.value = ''
                    }}
                    disabled={tagOptions.length === 0 || busy}
                  >
                    <option value="">Add tag filter…</option>
                    {tagOptions.map((t) => (
                      <option key={t.id} value={t.id} disabled={activeTagIds.includes(t.id)}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Tag match</span>
                  <select
                    value={tagModeDraft}
                    disabled={busy || activeTagIds.length < 2}
                    onChange={(e) => {
                      const mode = e.target.value === 'and' ? 'and' : 'or'
                      setTagModeDraft(mode)
                      pushFilter({ tag: tagDraft || 'all', tagMode: mode })
                    }}
                  >
                    <option value="or">Any tag (OR)</option>
                    <option value="and">All tags (AND)</option>
                  </select>
                </label>
                <label className="sf-media-library-search">
                  <span>Search</span>
                  <input
                    type="search"
                    value={qDraft}
                    onChange={(e) => setQDraft(e.target.value)}
                    placeholder="Alt or filename"
                  />
                </label>
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  disabled={busy}
                >
                  Filter
                </button>
                {filtersActive ? (
                  <button
                    type="button"
                    className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                    disabled={busy}
                    onClick={() =>
                      startTransition(() =>
                        router.push(
                          libraryHref({
                            category,
                            purpose: 'all',
                            tag: 'all',
                            tagMode: 'or',
                            q: '',
                            view,
                          }),
                        ),
                      )
                    }
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {activeTagIds.length ? (
                <div className="sf-media-tag-filter-chips" role="list" aria-label="Active tags">
                  {activeTagIds.map((id) => {
                    const label = tagOptions.find((t) => t.id === id)?.title || id
                    return (
                      <button
                        key={id}
                        type="button"
                        className="sf-media-chip is-active"
                        role="listitem"
                        disabled={busy}
                        title={`Remove ${label}`}
                        onClick={() => toggleTagFilter(id)}
                      >
                        {label} ×
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {tagOptions.length === 0 ? (
                <p className="layout-muted">
                  No shared tags yet — create some in{' '}
                  <Link href="/cms/admin/collections/tags">CMS → Tags</Link> to filter and tag uploads.
                </p>
              ) : null}
            </form>

            <form
              className="sf-media-library-upload"
              action={uploadAction}
              onSubmit={(e) => {
                setUploadHint(null)
                const fd = new FormData(e.currentTarget)
                const file = fd.get('file')
                if (!(file instanceof File) || file.size <= 0) {
                  e.preventDefault()
                  setUploadHint('Choose an image first (drop zone or Choose image…).')
                  return
                }
                const alt = String(fd.get('alt') ?? '').trim()
                if (!alt) {
                  e.preventDefault()
                  setUploadHint('Add a short alt text describing the image.')
                }
              }}
            >
              <h3>Upload</h3>
              {!storage.ready ? (
                <p className="form-error" role="alert">
                  {storage.detail ||
                    'Media storage is not ready. Check Media → Settings (local disk or S3).'}
                </p>
              ) : (
                <p className="layout-muted">
                  Drop an image or choose a file, then fill alt text and click Upload. Photos convert
                  to WebP; PNG logos stay PNG. Max edge {maxEdge}px (Media → Settings).
                </p>
              )}
              <MediaFileField disabled={busy || !storage.ready} />
              <div className="sf-media-library-upload-row">
                <label className="settings-field">
                  <span>Alt text</span>
                  <input
                    type="text"
                    name="alt"
                    placeholder="Describe the image"
                    disabled={busy || !storage.ready}
                    autoComplete="off"
                  />
                </label>
                <label className="settings-field">
                  <span>Folder</span>
                  <select
                    name="category"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    disabled={busy || !storage.ready}
                  >
                    <option value="">Uncategorized</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {'\u00A0'.repeat(c.depth * 2)}
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-field">
                  <span>Purpose</span>
                  <select
                    name="purpose"
                    value={uploadPurpose}
                    onChange={(e) => setUploadPurpose(e.target.value)}
                    disabled={busy || !storage.ready}
                  >
                    {MEDIA_PURPOSES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="settings-field">
                  <span>Tag</span>
                  <select
                    name="tag"
                    value={uploadTag}
                    onChange={(e) => setUploadTag(e.target.value)}
                    disabled={tagOptions.length === 0 || busy || !storage.ready}
                  >
                    <option value="">None</option>
                    {tagOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="page-settings-actions">
                  <button
                    type="submit"
                    className="gantry-toolbar-btn gantry-toolbar-btn-save"
                    disabled={busy || !storage.ready}
                  >
                    {uploading ? 'Uploading…' : 'Upload'}
                  </button>
                </div>
              </div>
              {uploadHint ? (
                <p className="admin-inline-error" role="alert">
                  {uploadHint}
                </p>
              ) : null}
              {uploadState.error ? (
                <p className="form-error" role="alert">
                  {uploadState.error}
                </p>
              ) : null}
            </form>
          </div>

          {initialDocs.length > 0 ? (
            <div className="sf-media-bulk-bar" role="toolbar" aria-label="Bulk actions">
              <label className="sf-media-bulk-select-all">
                <input
                  type="checkbox"
                  checked={selectedIds.length > 0 && selectedIds.length === initialDocs.length}
                  ref={(el) => {
                    if (el) {
                      el.indeterminate =
                        selectedIds.length > 0 && selectedIds.length < initialDocs.length
                    }
                  }}
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.checked) selectAllVisible()
                    else clearSelection()
                  }}
                />
                <span>
                  {selectedIds.length
                    ? `${selectedIds.length} selected`
                    : 'Select all on page'}
                </span>
              </label>
              <label>
                <span className="visually-hidden">Move to folder</span>
                <select
                  value={bulkCategory}
                  disabled={busy || !selectedIds.length}
                  onChange={(e) => setBulkCategory(e.target.value)}
                >
                  <option value="">Move to folder…</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {'\u00A0'.repeat(c.depth * 2)}
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="visually-hidden">Add tag</span>
                <select
                  value={bulkTag}
                  disabled={busy || !selectedIds.length || tagOptions.length === 0}
                  onChange={(e) => setBulkTag(e.target.value)}
                >
                  <option value="">Add tag…</option>
                  {tagOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy || !selectedIds.length || (!bulkCategory && !bulkTag)}
                onClick={runBulkUpdate}
              >
                {bulkUpdating ? 'Updating…' : 'Apply'}
              </button>
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy || !selectedIds.length}
                onClick={requestBulkDelete}
              >
                {bulkDeleting ? 'Deleting…' : 'Delete'}
              </button>
              {selectedIds.length ? (
                <button
                  type="button"
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  disabled={busy}
                  onClick={clearSelection}
                >
                  Clear selection
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            className={`sf-media-library-grid${view === 'list' ? ' is-list' : ' is-mosaic'}`}
            role="list"
            data-view={view}
          >
            {initialDocs.length === 0 ? (
              <div className="sf-media-library-empty" role="status">
                <p>
                  {category === 'all' && !filtersActive
                    ? 'No media yet.'
                    : `No media in ${activeFolderLabel.toLowerCase()}.`}
                </p>
                <p className="layout-muted">
                  {storage.ready
                    ? 'Upload above to add images, or pick another folder.'
                    : 'Configure storage, then upload to start the library.'}
                </p>
              </div>
            ) : null}
            {initialDocs.map((doc, index) => {
              const thumb = doc.sizes?.thumbnail || doc.url
              const cLabel = doc.categoryLabel
              const pLabel = doc.purpose
                ? MEDIA_PURPOSES.find((p) => p.value === doc.purpose)?.label || doc.purpose
                : null
              const isSelected = selected.has(doc.id)
              return (
                <article
                  key={doc.id}
                  className={`sf-media-library-card${view === 'list' ? ' is-list' : ''}${isSelected ? ' is-selected' : ''}`}
                  role="listitem"
                >
                  <label className="sf-media-library-select">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={busy}
                      aria-label={`Select ${doc.alt || doc.filename || doc.id}`}
                      onChange={() => toggleSelect(doc.id)}
                    />
                  </label>
                  <button
                    type="button"
                    className="sf-media-library-thumb"
                    disabled={busy}
                    aria-label={`Preview ${doc.alt || doc.filename || doc.id}`}
                    onClick={() => setLightboxIndex(index)}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" />
                    ) : (
                      <span>No preview</span>
                    )}
                  </button>
                  <div className="sf-media-library-card-body">
                    <strong className="sf-media-library-card-title">
                      {doc.alt || doc.filename || doc.id}
                    </strong>
                    <div className="sf-media-library-chips">
                      {cLabel && doc.categoryId ? (
                        <button
                          type="button"
                          className="sf-media-chip"
                          disabled={busy || category === doc.categoryId}
                          title={`Open folder ${cLabel}`}
                          onClick={() => selectCategory(doc.categoryId || 'all')}
                        >
                          {cLabel}
                        </button>
                      ) : null}
                      {pLabel && doc.purpose ? (
                        <button
                          type="button"
                          className={`sf-media-chip${purpose === doc.purpose ? ' is-active' : ''}`}
                          disabled={busy || purpose === doc.purpose}
                          title={`Filter purpose ${pLabel}`}
                          onClick={() => {
                            setPurposeDraft(doc.purpose || 'all')
                            pushFilter({ purpose: doc.purpose || 'all' })
                          }}
                        >
                          {pLabel}
                        </button>
                      ) : null}
                      {doc.tagIds?.map((id, i) => {
                        const label = doc.tagLabels?.[i] || id
                        const active = activeTagIds.includes(id)
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`sf-media-chip${active ? ' is-active' : ''}`}
                            disabled={busy}
                            title={active ? `Remove tag filter ${label}` : `Filter by ${label}`}
                            onClick={() => toggleTagFilter(id)}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                      disabled={busy}
                      onClick={() => setLightboxIndex(index)}
                    >
                      Preview
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>

      {deleteState.error || catError || bulkError || applySuggestState.error ? (
        <p className="form-error" role="alert">
          {deleteState.error || catError || bulkError || applySuggestState.error}
        </p>
      ) : null}

      {lightboxIndex != null && initialDocs.length > 0 ? (
        <MediaLightbox
          docs={initialDocs}
          index={lightboxIndex}
          onClose={() => {
            setLightboxIndex(null)
            setSuggestions(null)
            setAnalysisMessage(null)
          }}
          onIndexChange={(next) => {
            setLightboxIndex(next)
            setSuggestions(null)
            setAnalysisMessage(null)
          }}
          onDelete={requestDelete}
          deleting={deleting}
          onAnalyze={analysisAdapters.length ? requestAnalyze : undefined}
          analyzing={analyzing}
          analysisMessage={analysisMessage}
          analysisError={analyzeState.error || null}
          suggestions={suggestions}
          onApplySuggestions={requestApplySuggestions}
          applyingSuggestions={applyingSuggest}
          onDismissSuggestions={() => {
            setSuggestions(null)
            setAnalysisMessage(null)
          }}
        />
      ) : null}

      <AdminConfirmDialog
        open={bulkDeleteConfirmOpen}
        title="Delete selected media?"
        message={`Delete ${selectedIds.length} selected item${selectedIds.length === 1 ? '' : 's'}?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={confirmBulkDelete}
      />
    </div>
  )
}
