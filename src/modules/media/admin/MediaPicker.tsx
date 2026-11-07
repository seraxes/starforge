'use client'

import React, { useCallback, useEffect, useId, useState, useTransition } from 'react'

import {
  listMediaAction,
  listMediaCategoryTreeAction,
  listMediaTagOptionsAction,
  uploadMediaAction,
  type MediaActionState,
  type ResolvedMedia,
} from '@/core/media/actions'
import {
  flattenCategoryOptions,
  type MediaCategoryNode,
} from '@/core/media/categories'
import { MEDIA_PURPOSES } from '@/core/media/pipeline'
import type { MediaTagOption } from '@/core/media/resolve'

import { MediaFileField } from './MediaFileField'

export type MediaPickerValue = {
  mediaId: string
  url?: string
  alt?: string
}

type Props = {
  label?: string
  value: MediaPickerValue
  onChange: (next: MediaPickerValue) => void
  /** Default legacy folder slug for new uploads (mapped to category when possible). */
  defaultFolder?: string
  /** Default purpose for new uploads. */
  defaultPurpose?: string
  /** Prefer WebP card/large in preview when available. */
  disabled?: boolean
  /** Show advanced raw URL field (fallback). */
  allowUrlFallback?: boolean
  hint?: string
  /** Hidden input names (Logo uses mediaId/mediaUrl; Styles uses background*). */
  mediaIdName?: string
  mediaUrlName?: string
  /** When false, parent owns FormData keys (Styles autosave). */
  includeHiddenInputs?: boolean
}

const emptyUploadState: MediaActionState = {}

/**
 * Interim Starforge media picker (SF-66) — binds Payload Media ids.
 * Opens a modal over the Core library; raw URL is optional advanced fallback.
 */
export function MediaPicker({
  label = 'Media',
  value,
  onChange,
  defaultFolder = 'general',
  defaultPurpose = 'photo',
  disabled,
  allowUrlFallback = true,
  hint,
  mediaIdName = 'mediaId',
  mediaUrlName = 'mediaUrl',
  includeHiddenInputs = true,
}: Props) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState('all')
  const [purpose, setPurpose] = useState('all')
  const [tag, setTag] = useState('all')
  const [q, setQ] = useState('')
  const [docs, setDocs] = useState<ResolvedMedia[]>([])
  const [tagOptions, setTagOptions] = useState<MediaTagOption[]>([])
  const [categoryTree, setCategoryTree] = useState<MediaCategoryNode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [uploadState, setUploadState] = useState<MediaActionState>(emptyUploadState)
  const [uploading, setUploading] = useState(false)
  const [showUrl, setShowUrl] = useState(Boolean(value.url && !value.mediaId))

  const categoryOptions = flattenCategoryOptions(categoryTree)
  const defaultCategoryId =
    categoryOptions.find((c) => c.slug === defaultFolder)?.id ||
    categoryOptions[0]?.id ||
    ''

  const refresh = useCallback(() => {
    startTransition(async () => {
      setError(null)
      const [res, tagsRes, catsRes] = await Promise.all([
        listMediaAction({
          category: category === 'all' ? undefined : category,
          purpose: purpose === 'all' ? undefined : purpose,
          tag: tag === 'all' ? undefined : tag,
          q: q.trim() || undefined,
          limit: 48,
        }),
        listMediaTagOptionsAction(),
        listMediaCategoryTreeAction(),
      ])
      if (tagsRes.tags) setTagOptions(tagsRes.tags)
      if (catsRes.tree) setCategoryTree(catsRes.tree)
      if (res.error) {
        setError(res.error)
        setDocs([])
        return
      }
      setDocs(res.result?.docs ?? [])
    })
  }, [category, purpose, tag, q])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function selectDoc(doc: ResolvedMedia) {
    onChange({
      mediaId: doc.id,
      url: doc.url,
      alt: doc.alt || value.alt || '',
    })
    setOpen(false)
  }

  function clear() {
    onChange({ mediaId: '', url: '', alt: value.alt })
  }

  async function onUpload(formData: FormData) {
    setUploadState(emptyUploadState)
    const file = formData.get('file')
    if (!(file instanceof File) || file.size <= 0) {
      setUploadState({ error: 'Choose an image first (drop zone or Choose image…).' })
      return
    }
    if (!formData.get('category') && defaultCategoryId) {
      formData.set('category', defaultCategoryId)
    }
    if (!formData.get('folder')) {
      formData.set('folder', defaultFolder)
    }
    setUploading(true)
    try {
      const next = await uploadMediaAction(emptyUploadState, formData)
      setUploadState(next)
      if (next.ok && next.media) {
        selectDoc(next.media)
        refresh()
      }
    } finally {
      setUploading(false)
    }
  }

  const previewSrc = value.url || (value.mediaId ? `/api/media/${value.mediaId}` : '')
  const uploadCategory =
    category !== 'all' ? category : defaultCategoryId

  return (
    <div className="sf-media-picker">
      <div className="sf-media-picker-head">
        <span className="sf-media-picker-label">{label}</span>
        <div className="sf-media-picker-actions">
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            {value.mediaId ? 'Change' : 'Choose from library'}
          </button>
          {value.mediaId || value.url ? (
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={disabled}
              onClick={clear}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {previewSrc ? (
        <div className="sf-media-picker-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewSrc} alt={value.alt || 'Selected media'} />
          <div className="sf-media-picker-meta">
            {value.mediaId ? (
              <code title="Payload Media id">{value.mediaId}</code>
            ) : (
              <span className="layout-muted">URL fallback</span>
            )}
            {value.alt ? <span>{value.alt}</span> : null}
          </div>
        </div>
      ) : (
        <p className="layout-muted sf-media-picker-empty">No media selected</p>
      )}

      {includeHiddenInputs ? (
        <input type="hidden" name={mediaIdName} value={value.mediaId ?? ''} />
      ) : null}
      {hint ? <small className="field-hint">{hint}</small> : null}

      {allowUrlFallback ? (
        <details
          className="sf-media-picker-advanced"
          open={showUrl}
          onToggle={(e) => setShowUrl((e.target as HTMLDetailsElement).open)}
        >
          <summary>Advanced: raw URL</summary>
          <label className="settings-field">
            <span>Image URL</span>
            <input
              type="url"
              name={includeHiddenInputs ? mediaUrlName : undefined}
              className="gantry-inline-input"
              value={value.url ?? ''}
              disabled={disabled}
              placeholder="https://… or /media/… (fallback only)"
              onChange={(e) =>
                onChange({
                  mediaId: value.mediaId,
                  url: e.target.value,
                  alt: value.alt,
                })
              }
            />
          </label>
        </details>
      ) : includeHiddenInputs ? (
        <input type="hidden" name={mediaUrlName} value={value.url ?? ''} />
      ) : null}

      {open ? (
        <div className="sf-media-picker-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="sf-media-picker-dialog">
            <header className="sf-media-picker-dialog-head">
              <h3 id={titleId}>Media library</h3>
              <button type="button" className="gantry-toolbar-btn gantry-toolbar-btn-muted" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>

            <div className="sf-media-picker-toolbar">
              <label>
                <span className="sr-only">Folder</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All folders</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {'\u00A0'.repeat(c.depth * 2)}
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Purpose</span>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
                  <option value="all">All purposes</option>
                  {MEDIA_PURPOSES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="sr-only">Tag</span>
                <select
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  disabled={tagOptions.length === 0}
                >
                  <option value="all">All tags</option>
                  {tagOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sf-media-picker-search">
                <span className="sr-only">Search</span>
                <input
                  type="search"
                  value={q}
                  placeholder="Search alt / filename"
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      refresh()
                    }
                  }}
                />
              </label>
              <button type="button" className="gantry-toolbar-btn gantry-toolbar-btn-muted" onClick={refresh} disabled={pending}>
                Refresh
              </button>
            </div>

            <form className="sf-media-picker-upload" action={onUpload}>
              <input type="hidden" name="category" value={uploadCategory} />
              <input type="hidden" name="folder" value={defaultFolder} />
              <input type="hidden" name="purpose" value={defaultPurpose} />
              {tag !== 'all' ? <input type="hidden" name="tag" value={tag} /> : null}
              <MediaFileField disabled={disabled || uploading || pending} />
              <label className="settings-field">
                <span>Alt</span>
                <input
                  type="text"
                  name="alt"
                  placeholder="Describe the image"
                  disabled={disabled || uploading}
                  autoComplete="off"
                />
              </label>
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={disabled || uploading || pending}
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              {uploadState.error ? (
                <p className="form-error" role="alert">
                  {uploadState.error}
                </p>
              ) : null}
            </form>

            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="sf-media-picker-grid" data-pending={pending ? '1' : '0'}>
              {docs.length === 0 && !pending ? (
                <p className="layout-muted">No media yet — upload above or in CMS → Media.</p>
              ) : null}
              {docs.map((doc) => {
                const selected = String(value.mediaId) === doc.id
                const thumb = doc.sizes?.thumbnail || doc.url
                return (
                  <button
                    key={doc.id}
                    type="button"
                    className={`sf-media-picker-tile${selected ? ' is-selected' : ''}`}
                    onClick={() => selectDoc(doc)}
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt={doc.alt || doc.filename || 'Media'} />
                    ) : (
                      <span className="sf-media-picker-tile-fallback">{doc.filename || doc.id}</span>
                    )}
                    <span className="sf-media-picker-tile-cap">{doc.alt || doc.filename || doc.id}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
