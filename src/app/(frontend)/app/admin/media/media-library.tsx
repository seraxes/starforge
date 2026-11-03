'use client'

import React, { useActionState, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import { MediaCategoryTree } from '@/components/admin/MediaCategoryTree'
import { MediaLightbox } from '@/components/admin/MediaLightbox'
import {
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
import { MEDIA_PURPOSES } from '@/core/media/pipeline'
import type { MediaTagOption } from '@/core/media/resolve'
import type { MediaStorageInfo } from '@/core/media/storage'

import { useAdminToast } from '../admin-toast'

const empty: MediaActionState = {}

export type MediaLibraryView = 'mosaic' | 'list'

type Props = {
  initialDocs: ResolvedMedia[]
  totalDocs: number
  storage: MediaStorageInfo
  category: string
  purpose: string
  tag: string
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
  q?: string
  view?: MediaLibraryView
}): string {
  const params = new URLSearchParams()
  const c = next.category ?? 'all'
  const p = next.purpose ?? 'all'
  const t = next.tag ?? 'all'
  const query = next.q ?? ''
  const view = next.view ?? 'mosaic'
  if (c && c !== 'all') params.set('category', c)
  if (p && p !== 'all') params.set('purpose', p)
  if (t && t !== 'all') params.set('tag', t)
  if (query.trim()) params.set('q', query.trim())
  if (view && view !== 'mosaic') params.set('view', view)
  const qs = params.toString()
  return qs ? `/app/admin/media?${qs}` : '/app/admin/media'
}

export function MediaLibraryClient({
  initialDocs,
  totalDocs,
  storage,
  category,
  purpose,
  tag,
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
  const [tagDraft, setTagDraft] = useState(tag)
  const [qDraft, setQDraft] = useState(q)
  const [uploadCategory, setUploadCategory] = useState(category !== 'all' ? category : '')
  const [uploadPurpose, setUploadPurpose] = useState('photo')
  const [uploadTag, setUploadTag] = useState(tag !== 'all' ? tag : '')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const busy = uploading || deleting || pending || creatingCat || renamingCat || deletingCat
  const categoryOptions = useMemo(() => flattenCategoryOptions(categoryTree), [categoryTree])

  // Keep drafts in sync when URL filters change (Clear / chip / folder / back).
  React.useEffect(() => {
    setPurposeDraft(purpose)
    setTagDraft(tag)
    setQDraft(q)
    if (category !== 'all') setUploadCategory(category)
    if (tag !== 'all') setUploadTag(tag)
  }, [category, purpose, tag, q])

  React.useEffect(() => {
    if (uploadState.ok) {
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

  const filterHref = useMemo(
    () =>
      libraryHref({
        category,
        purpose: purposeDraft,
        tag: tagDraft,
        q: qDraft,
        view,
      }),
    [category, purposeDraft, tagDraft, qDraft, view],
  )

  const filtersActive =
    (purpose && purpose !== 'all') || (tag && tag !== 'all') || Boolean(q.trim())

  const activeCategory = category !== 'all' ? findCategoryInTree(categoryTree, category) : null
  const activeFolderLabel = activeCategory?.path || activeCategory?.title || 'All media'

  function pushFilter(next: {
    category?: string
    purpose?: string
    tag?: string
    q?: string
    view?: MediaLibraryView
  }) {
    const href = libraryHref({
      category: next.category ?? category,
      purpose: next.purpose ?? purposeDraft,
      tag: next.tag ?? tagDraft,
      q: next.q ?? qDraft,
      view: next.view ?? view,
    })
    startTransition(() => router.push(href))
  }

  function selectCategory(nextCategory: string) {
    if (nextCategory !== 'all') setUploadCategory(nextCategory)
    pushFilter({ category: nextCategory })
  }

  function requestDelete(id: string) {
    const fd = new FormData()
    fd.set('id', id)
    startTransition(() => {
      void deleteAction(fd)
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

  const catError =
    createCatState.error || renameCatState.error || deleteCatState.error || null

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
            <Link href="/app/admin/site-chrome/environment">Chrome → Environment</Link> (or{' '}
            <code>.env</code>). Incomplete <code>s3</code> never falls back to local disk.
          </p>
        ) : null}
        <p className="layout-muted">
          Analysis port: {analysisAdapters.length ? analysisAdapters.join(', ') : 'none'} (stub —
          hooks off until Site Settings). {totalDocs} item{totalDocs === 1 ? '' : 's'} in{' '}
          <strong>{activeFolderLabel}</strong>. Pipeline rules:{' '}
          <Link href="/app/admin/media/settings">Media → Settings</Link>. Payload CMS Media remains
          the store — <Link href="/admin/collections/media">open in CMS</Link>.
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
                . Use the folder tree to open a folder; purpose / tag / search refine within it.
              </p>
              <div className="sf-media-library-filters-row">
                <label>
                  <span>Purpose</span>
                  <select value={purposeDraft} onChange={(e) => setPurposeDraft(e.target.value)}>
                    <option value="all">All</option>
                    {MEDIA_PURPOSES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Tag</span>
                  <select
                    value={tagDraft}
                    onChange={(e) => setTagDraft(e.target.value)}
                    disabled={tagOptions.length === 0}
                  >
                    <option value="all">All</option>
                    {tagOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
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
              {tagOptions.length === 0 ? (
                <p className="layout-muted">
                  No shared tags yet — create some in{' '}
                  <Link href="/admin/collections/tags">CMS → Tags</Link> to filter and tag uploads.
                </p>
              ) : null}
            </form>

            <form className="sf-media-library-upload" action={uploadAction}>
              <h3>Upload</h3>
              <p className="layout-muted">
                Mobile-friendly: use the file control to pick from gallery or camera. Photos convert
                to WebP; PNG logos stay PNG. Max edge {maxEdge}px (Media → Settings). Active folder
                is the default upload target. Optional tag uses shared CMS Tags.
              </p>
              <div className="sf-media-library-upload-row">
                <label>
                  <span>File</span>
                  <input
                    type="file"
                    name="file"
                    accept="image/*"
                    capture="environment"
                    required
                    disabled={!storage.ready}
                  />
                </label>
                <label>
                  <span>Alt text</span>
                  <input type="text" name="alt" placeholder="Describe the image" required />
                </label>
                <label>
                  <span>Folder</span>
                  <select
                    name="category"
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
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
                <label>
                  <span>Purpose</span>
                  <select
                    name="purpose"
                    value={uploadPurpose}
                    onChange={(e) => setUploadPurpose(e.target.value)}
                  >
                    {MEDIA_PURPOSES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Tag</span>
                  <select
                    name="tag"
                    value={uploadTag}
                    onChange={(e) => setUploadTag(e.target.value)}
                    disabled={tagOptions.length === 0}
                  >
                    <option value="">None</option>
                    {tagOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-save"
                  disabled={busy || !storage.ready}
                >
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </div>
              {uploadState.error ? (
                <p className="form-error" role="alert">
                  {uploadState.error}
                </p>
              ) : null}
            </form>
          </div>

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
              return (
                <article
                  key={doc.id}
                  className={`sf-media-library-card${view === 'list' ? ' is-list' : ''}`}
                  role="listitem"
                >
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
                      {pLabel ? <span className="sf-media-chip is-static">{pLabel}</span> : null}
                      {doc.tagIds?.map((id, i) => {
                        const label = doc.tagLabels?.[i] || id
                        const active = tag === id
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`sf-media-chip${active ? ' is-active' : ''}`}
                            disabled={busy || active}
                            title={active ? 'Already filtering this tag' : `Filter by ${label}`}
                            onClick={() => pushFilter({ tag: id })}
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

      {deleteState.error || catError ? (
        <p className="form-error" role="alert">
          {deleteState.error || catError}
        </p>
      ) : null}

      {lightboxIndex != null && initialDocs.length > 0 ? (
        <MediaLightbox
          docs={initialDocs}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onDelete={requestDelete}
          deleting={deleting}
        />
      ) : null}
    </div>
  )
}
