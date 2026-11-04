'use client'

import React, { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'

import type { MediaSuggestionPatch } from '@/core/media/library-query'
import type { ResolvedMedia } from '@/core/media/resolve'
import { MEDIA_FOLDERS, MEDIA_PURPOSES } from '@/core/media/pipeline'

export function mediaLightboxSrc(doc: ResolvedMedia): string {
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
}

/**
 * Shared Media Manager lightbox — large preview, meta, Close / Esc / ← →.
 * Used by Core library; pickers may reuse for preview parity.
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
}: Props) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [copied, setCopied] = useState(false)

  const safeIndex = docs.length === 0 ? -1 : Math.min(Math.max(index, 0), docs.length - 1)
  const doc = safeIndex >= 0 ? docs[safeIndex] : null
  const canPrev = safeIndex > 0
  const canNext = safeIndex >= 0 && safeIndex < docs.length - 1

  useEffect(() => {
    if (!doc) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
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
  }, [doc, canPrev, canNext, onClose, onIndexChange, safeIndex])

  useEffect(() => {
    if (!doc) return
    closeRef.current?.focus()
  }, [doc?.id])

  if (!doc) return null

  const preview = mediaLightboxSrc(doc)
  const folder = folderLabel(doc)
  const purpose = purposeLabel(doc.purpose)
  const dims = dimensions(doc)
  const tags =
    doc.tagLabels?.length
      ? doc.tagLabels
      : doc.tagIds?.length
        ? doc.tagIds
        : []

  const busy = Boolean(deleting || analyzing || applyingSuggestions)

  // Stay inside `.admin-shell` so panel tokens inherit (no body portal).
  return (
    <div className="sf-media-lightbox" role="presentation">
      <div
        className="sf-media-lightbox-backdrop"
        aria-hidden="true"
        onMouseDown={(e) => {
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
              <p className="layout-muted">No preview</p>
            )}
          </div>

          <aside className="sf-media-lightbox-meta" aria-label="Media details">
            <dl className="sf-media-lightbox-dl">
              <div>
                <dt>Alt</dt>
                <dd>{doc.alt || '—'}</dd>
              </div>
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
              {doc.url ? (
                <a
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open file
                </a>
              ) : null}
              <Link
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                href={`/admin/collections/media/${doc.id}`}
              >
                Open in CMS
              </Link>
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
                  onClick={() => {
                    if (!confirm('Delete this media item?')) return
                    onDelete(doc.id)
                  }}
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
    </div>
  )
}
