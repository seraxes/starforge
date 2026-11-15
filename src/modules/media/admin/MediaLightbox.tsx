'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'
import type { MediaSuggestionPatch } from '@/core/media/library-query'
import {
  ADMIN_LIBRARY_ACCEPT,
  isAdminLibraryUploadAllowed,
  mediaAdminFileHref,
  mediaLibraryPreviewKind,
  type MediaLibraryPreviewKind,
} from '@/core/media/library-files'
import { MEDIA_FOLDERS, MEDIA_PURPOSES } from '@/core/media/pipeline'
import type { MediaTagOption, ResolvedMedia } from '@/core/media/resolve'

import type { MediaLibraryChrome } from './media-chrome'

export function mediaLightboxSrc(doc: ResolvedMedia): string {
  const gated = mediaAdminFileHref(doc, { inline: true })
  if (gated) return gated
  const mime = (doc.mimeType || '').toLowerCase()
  const keepOriginal = doc.purpose === 'logo' || mime === 'image/png'
  if (keepOriginal) {
    return (
      doc.originalUrl ||
      doc.url ||
      doc.sizes?.large ||
      doc.sizes?.card ||
      doc.sizes?.thumbnail ||
      ''
    )
  }
  return doc.sizes?.large || doc.sizes?.card || doc.url || doc.sizes?.thumbnail || ''
}

function folderLabel(doc: ResolvedMedia): string | null {
  if (doc.categoryLabel) return doc.categoryLabel
  if (!doc.folder) return null
  return MEDIA_FOLDERS.find((f) => f.value === doc.folder)?.label || doc.folder
}

function purposeLabel(value: string | null | undefined): string | null {
  if (!value) return null
  return MEDIA_PURPOSES.find((p) => p.value === value)?.label || value
}

function dimensions(doc: ResolvedMedia): string | null {
  if (doc.width && doc.height) return `${doc.width}×${doc.height}`
  if (doc.width) return `${doc.width}w`
  if (doc.height) return `${doc.height}h`
  return null
}

function badgeText(kind: MediaLibraryPreviewKind, chrome: MediaLibraryChrome): string {
  if (kind === 'pdf') return chrome.filePdf
  if (kind === 'doc') return chrome.fileDoc
  if (kind === 'text') return chrome.fileText
  return chrome.fileOther
}

function isFormField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export type MediaDetailsPatch = {
  alt: string
  purpose: string
  categoryId: string
  tagIds: string[]
  isPrivate: boolean
}

type CategoryOption = { id: string; title: string; depth: number }

type Props = {
  docs: ResolvedMedia[]
  index: number
  onClose: () => void
  onIndexChange: (next: number) => void
  /** Optional delete handler — confirm lives here. */
  onDelete?: (id: string) => void
  deleting?: boolean
  /** Phase 3 — MediaAnalysisPort Analyze (explicit; never auto). */
  onAnalyze?: (id: string) => void
  analyzing?: boolean
  analysisMessage?: string | null
  analysisError?: string | null
  suggestions?: MediaSuggestionPatch | null
  onApplySuggestions?: (id: string, patch: MediaSuggestionPatch) => void
  applyingSuggestions?: boolean
  onDismissSuggestions?: () => void
  /** Phase 2a edit panel. Absent → preview-only (no CMS link). */
  chrome?: MediaLibraryChrome
  categoryOptions?: CategoryOption[]
  tagOptions?: MediaTagOption[]
  canChooseDecode?: boolean
  canChooseResize?: boolean
  onSaveDetails?: (id: string, patch: MediaDetailsPatch) => void
  savingDetails?: boolean
  detailsError?: string | null
  onReplaceFile?: (
    id: string,
    file: File,
    flags: { decodeToWebp: boolean; resize: boolean },
  ) => void
  replacingFile?: boolean
  replaceError?: string | null
}

/**
 * Shared Media Manager lightbox — large preview, meta, Close / Esc / ← →.
 * The edit panel is the daily path for alt, purpose, tags, private, and category.
 */
export function MediaLightbox({
  docs,
  index,
  onClose,
  onIndexChange,
  onDelete,
  deleting,
  onAnalyze,
  analyzing,
  analysisMessage,
  analysisError,
  suggestions,
  onApplySuggestions,
  applyingSuggestions,
  onDismissSuggestions,
  chrome,
  categoryOptions = [],
  tagOptions = [],
  canChooseDecode = false,
  canChooseResize = false,
  onSaveDetails,
  savingDetails,
  detailsError,
  onReplaceFile,
  replacingFile,
  replaceError,
}: Props) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)
  /** Confirm stays open only while still viewing this id (no effect reset). */
  const [deleteConfirmForId, setDeleteConfirmForId] = useState<string | null>(null)

  const safeIndex = docs.length === 0 ? -1 : Math.min(Math.max(index, 0), docs.length - 1)
  const doc = safeIndex >= 0 ? docs[safeIndex] : null
  const canPrev = safeIndex > 0
  const canNext = safeIndex >= 0 && safeIndex < docs.length - 1
  const deleteConfirmOpen = Boolean(doc && deleteConfirmForId === doc.id)

  useEffect(() => {
    if (!doc || deleteConfirmOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (isFormField(event.target)) return
      if (event.key === 'ArrowLeft' && canPrev) {
        event.preventDefault()
        onIndexChange(safeIndex - 1)
        return
      }
      if (event.key === 'ArrowRight' && canNext) {
        event.preventDefault()
        onIndexChange(safeIndex + 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [doc, canPrev, canNext, onClose, onIndexChange, safeIndex, deleteConfirmOpen])

  useEffect(() => {
    if (!doc) return
    closeRef.current?.focus()
  }, [doc?.id])

  if (!doc) return null

  const kind = mediaLibraryPreviewKind(doc.mimeType, doc.filename)
  const preview = kind === 'image' ? mediaLightboxSrc(doc) : ''
  const folder = folderLabel(doc)
  const purpose = purposeLabel(doc.purpose)
  const dims = dimensions(doc)
  const tags =
    doc.tagLabels?.length ? doc.tagLabels : doc.tagIds?.length ? doc.tagIds : []
  const openHref =
    mediaAdminFileHref(doc, { inline: true }) || doc.originalUrl || doc.url || ''
  const openLabel = chrome?.openFile ?? 'Open file'
  const noPreview = chrome?.noPreview ?? 'No preview'

  const busy = Boolean(deleting || analyzing || applyingSuggestions || savingDetails || replacingFile)

  // Stay inside `.admin-shell` so panel tokens inherit (no body portal).
  return (
    <div className="sf-media-lightbox" role="presentation">
      <div
        className="sf-media-lightbox-backdrop"
        aria-hidden="true"
        onMouseDown={(e) => {
          if (deleteConfirmOpen) return
          if (e.target === e.currentTarget) onClose()
        }}
      />
      <div
        className="sf-media-lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="sf-media-lightbox-head">
          <h3 id={titleId}>{doc.alt || doc.filename || 'Media preview'}</h3>
          <div className="sf-media-lightbox-head-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={!canPrev || busy}
              aria-label="Previous media"
              onClick={() => onIndexChange(safeIndex - 1)}
            >
              ←
            </button>
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={!canNext || busy}
              aria-label="Next media"
              onClick={() => onIndexChange(safeIndex + 1)}
            >
              →
            </button>
            <button
              ref={closeRef}
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              aria-label="Close"
              disabled={busy}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </header>

        <div className="sf-media-lightbox-body">
          <div className="sf-media-lightbox-preview">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt={doc.alt || doc.filename || 'Media'} />
            ) : (
              <p className="sf-media-file-badge" role="img" aria-label={noPreview}>
                {chrome ? badgeText(kind, chrome) : noPreview}
              </p>
            )}
          </div>

          <aside className="sf-media-lightbox-meta" aria-label="Media details">
            {chrome && onSaveDetails ? (
              <MediaDetailsEditor
                key={doc.id}
                doc={doc}
                chrome={chrome}
                categoryOptions={categoryOptions}
                tagOptions={tagOptions}
                busy={busy}
                saving={Boolean(savingDetails)}
                error={detailsError}
                onSave={(patch) => onSaveDetails(doc.id, patch)}
              />
            ) : (
              <dl className="sf-media-lightbox-dl">
                <div>
                  <dt>Alt</dt>
                  <dd>{doc.alt || '—'}</dd>
                </div>
                {folder ? (
                  <div>
                    <dt>Category</dt>
                    <dd>{folder}</dd>
                  </div>
                ) : null}
                {purpose ? (
                  <div>
                    <dt>Purpose</dt>
                    <dd>{purpose}</dd>
                  </div>
                ) : null}
                {tags.length ? (
                  <div>
                    <dt>Tags</dt>
                    <dd>{tags.join(', ')}</dd>
                  </div>
                ) : null}
              </dl>
            )}

            {chrome && onReplaceFile ? (
              <MediaReplaceEditor
                key={`replace-${doc.id}`}
                chrome={chrome}
                busy={busy}
                replacing={Boolean(replacingFile)}
                error={replaceError}
                canChooseDecode={canChooseDecode}
                canChooseResize={canChooseResize}
                onReplace={(file, flags) => onReplaceFile(doc.id, file, flags)}
              />
            ) : null}

            <dl className="sf-media-lightbox-dl">
              <div>
                <dt>Filename</dt>
                <dd>{doc.filename || '—'}</dd>
              </div>
              <div>
                <dt>mediaId</dt>
                <dd>
                  <code>{doc.id}</code>
                </dd>
              </div>
              {doc.mimeType ? (
                <div>
                  <dt>Type</dt>
                  <dd>{doc.mimeType}</dd>
                </div>
              ) : null}
              {dims ? (
                <div>
                  <dt>Size</dt>
                  <dd>{dims}</dd>
                </div>
              ) : null}
            </dl>

            <div className="sf-media-lightbox-actions">
              {openHref ? (
                <a
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  href={openHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  {openLabel}
                </a>
              ) : null}
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(doc.id)
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 1200)
                  } catch {
                    /* ignore */
                  }
                }}
              >
                {copied ? 'Copied' : 'Copy mediaId'}
              </button>
              {onAnalyze ? (
                <button
                  type="button"
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  disabled={busy}
                  onClick={() => onAnalyze(doc.id)}
                >
                  {analyzing ? 'Analyzing…' : 'Analyze'}
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  disabled={busy}
                  onClick={() => setDeleteConfirmForId(doc.id)}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              ) : null}
            </div>

            {analysisError ? (
              <p className="form-error" role="alert">
                {analysisError}
              </p>
            ) : null}
            {analysisMessage ? (
              <p className="layout-muted" role="status">
                {analysisMessage}
              </p>
            ) : null}

            {suggestions && onApplySuggestions ? (
              <div className="sf-media-lightbox-suggestions" role="region" aria-label="Analysis suggestions">
                <h4>Suggestions</h4>
                <ul>
                  {suggestions.alt ? (
                    <li>
                      Alt: <strong>{suggestions.alt}</strong>
                    </li>
                  ) : null}
                  {suggestions.purpose ? (
                    <li>
                      Purpose: <strong>{purposeLabel(suggestions.purpose)}</strong>
                    </li>
                  ) : null}
                  {suggestions.categoryId ? (
                    <li>
                      Folder id: <code>{suggestions.categoryId}</code>
                    </li>
                  ) : null}
                  {suggestions.tagIds?.length ? (
                    <li>
                      Tags: <code>{suggestions.tagIds.join(', ')}</code>
                    </li>
                  ) : null}
                </ul>
                <div className="sf-media-lightbox-actions">
                  <button
                    type="button"
                    className="gantry-toolbar-btn gantry-toolbar-btn-save"
                    disabled={busy}
                    onClick={() => onApplySuggestions(doc.id, suggestions)}
                  >
                    {applyingSuggestions ? 'Applying…' : 'Apply suggestions'}
                  </button>
                  {onDismissSuggestions ? (
                    <button
                      type="button"
                      className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                      disabled={busy}
                      onClick={onDismissSuggestions}
                    >
                      Dismiss
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <p className="layout-muted sf-media-lightbox-hint">
              Esc closes · ← → browse current filter
              {docs.length > 1 ? ` (${safeIndex + 1} / ${docs.length})` : null}
            </p>
          </aside>
        </div>
      </div>

      <AdminConfirmDialog
        open={deleteConfirmOpen}
        title="Delete media?"
        message="Delete this media item?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onCancel={() => setDeleteConfirmForId(null)}
        onConfirm={() => {
          setDeleteConfirmForId(null)
          onDelete?.(doc.id)
        }}
      />
    </div>
  )
}

function MediaDetailsEditor({
  doc,
  chrome,
  categoryOptions,
  tagOptions,
  busy,
  saving,
  error,
  onSave,
}: {
  doc: ResolvedMedia
  chrome: MediaLibraryChrome
  categoryOptions: CategoryOption[]
  tagOptions: MediaTagOption[]
  busy: boolean
  saving: boolean
  error?: string | null
  onSave: (patch: MediaDetailsPatch) => void
}) {
  const [alt, setAlt] = useState(doc.alt || '')
  const [purpose, setPurpose] = useState<string>(doc.purpose || 'photo')
  const [categoryId, setCategoryId] = useState(doc.categoryId || '')
  const [tagIds, setTagIds] = useState<string[]>(doc.tagIds ?? [])
  const [isPrivate, setIsPrivate] = useState(doc.private === true || doc.folder === 'forms')
  const knownCategory = !categoryId || categoryOptions.some((c) => c.id === categoryId)
  const formsLocked = doc.folder === 'forms' && categoryId === (doc.categoryId || '')

  return (
    <form
      className="sf-media-lightbox-edit"
      onSubmit={(e) => {
        e.preventDefault()
        if (!alt.trim() || busy) return
        onSave({
          alt: alt.trim(),
          purpose,
          categoryId,
          tagIds,
          isPrivate: formsLocked || isPrivate,
        })
      }}
    >
      <h4>{chrome.editHeading}</h4>
      <label className="settings-field">
        <span>{chrome.fieldAlt}</span>
        <input
          type="text"
          value={alt}
          disabled={busy}
          autoComplete="off"
          onChange={(e) => setAlt(e.target.value)}
        />
      </label>
      <label className="settings-field">
        <span>{chrome.fieldPurpose}</span>
        <select value={purpose} disabled={busy} onChange={(e) => setPurpose(e.target.value)}>
          {MEDIA_PURPOSES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>{chrome.fieldCategory}</span>
        <select
          value={categoryId}
          disabled={busy}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">{chrome.uncategorized}</option>
          {!knownCategory ? <option value={categoryId}>{doc.categoryLabel || categoryId}</option> : null}
          {categoryOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {'\u00A0'.repeat(c.depth * 2)}
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <div className="settings-field">
        <span>{chrome.fieldTags}</span>
        {tagOptions.length === 0 ? (
          <p className="settings-hint">{chrome.noTagsYet}</p>
        ) : (
          <ul className="sf-media-tag-checks">
            {tagOptions.map((tag) => {
              const checked = tagIds.includes(tag.id)
              return (
                <li key={tag.id}>
                  <label className="settings-flag">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() => {
                        setTagIds((prev) =>
                          prev.includes(tag.id)
                            ? prev.filter((id) => id !== tag.id)
                            : [...prev, tag.id],
                        )
                      }}
                    />
                    <span>{tag.title}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <label className="settings-flag">
        <input
          type="checkbox"
          checked={formsLocked || isPrivate}
          disabled={busy || formsLocked}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        <span>{chrome.fieldPrivate}</span>
      </label>
      <p className="settings-hint">{chrome.privateHint}</p>
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="page-settings-actions">
        <button
          type="submit"
          className="gantry-toolbar-btn gantry-toolbar-btn-save"
          disabled={busy || !alt.trim()}
        >
          {saving ? chrome.savingDetails : chrome.saveDetails}
        </button>
      </div>
    </form>
  )
}

function MediaReplaceEditor({
  chrome,
  busy,
  replacing,
  error,
  canChooseDecode,
  canChooseResize,
  onReplace,
}: {
  chrome: MediaLibraryChrome
  busy: boolean
  replacing: boolean
  error?: string | null
  canChooseDecode: boolean
  canChooseResize: boolean
  onReplace: (file: File, flags: { decodeToWebp: boolean; resize: boolean }) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [decodeToWebp, setDecodeToWebp] = useState(true)
  const [resize, setResize] = useState(true)
  const image = file ? mediaLibraryPreviewKind(file.type, file.name) === 'image' : false

  return (
    <form
      className="sf-media-lightbox-edit"
      onSubmit={(e) => {
        e.preventDefault()
        setHint(null)
        if (!file) {
          setHint(chrome.replaceNeedsFile)
          return
        }
        if (!isAdminLibraryUploadAllowed(file.type, file.name, { documents: true })) {
          setHint(chrome.fileTypeRejected)
          return
        }
        onReplace(file, {
          decodeToWebp: !canChooseDecode || decodeToWebp,
          resize: !canChooseResize || resize,
        })
      }}
    >
      <h4>{chrome.replaceHeading}</h4>
      <p className="settings-hint">{chrome.replaceHint}</p>
      <div className="sf-media-replace-row">
        <input
          ref={inputRef}
          type="file"
          accept={ADMIN_LIBRARY_ACCEPT}
          disabled={busy}
          className="sf-media-file-field-input"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            setHint(null)
          }}
        />
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {file ? chrome.changeFile : chrome.chooseFile}
        </button>
        {file ? <span className="layout-muted">{file.name}</span> : null}
      </div>
      {image && (canChooseDecode || canChooseResize) ? (
        <div className="sf-media-file-field-options" role="group" aria-label="Encode options">
          {canChooseDecode ? (
            <label className="settings-flag">
              <input
                type="checkbox"
                checked={decodeToWebp}
                disabled={busy}
                onChange={(e) => setDecodeToWebp(e.target.checked)}
              />
              <span>Decode to WebP</span>
            </label>
          ) : null}
          {canChooseResize ? (
            <label className="settings-flag">
              <input
                type="checkbox"
                checked={resize}
                disabled={busy}
                onChange={(e) => setResize(e.target.checked)}
              />
              <span>Resize</span>
            </label>
          ) : null}
        </div>
      ) : null}
      {hint ? (
        <p className="admin-inline-error" role="alert">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="page-settings-actions">
        <button type="submit" className="gantry-toolbar-btn" disabled={busy || !file}>
          {replacing ? chrome.replacingFile : chrome.replaceFile}
        </button>
      </div>
    </form>
  )
}
