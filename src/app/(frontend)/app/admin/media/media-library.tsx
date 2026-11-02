'use client'

import React, { useActionState, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import {
  deleteMediaAction,
  uploadMediaAction,
  type MediaActionState,
  type ResolvedMedia,
} from '@/core/media/actions'
import { MEDIA_FOLDERS, MEDIA_PURPOSES } from '@/core/media/pipeline'
import type { MediaStorageInfo } from '@/core/media/storage'

import { useAdminToast } from '../admin-toast'

const empty: MediaActionState = {}

type Props = {
  initialDocs: ResolvedMedia[]
  totalDocs: number
  storage: MediaStorageInfo
  folder: string
  purpose: string
  q: string
}

export function MediaLibraryClient({
  initialDocs,
  totalDocs,
  storage,
  folder,
  purpose,
  q,
}: Props) {
  const router = useRouter()
  const { notifySaved } = useAdminToast()
  const [uploadState, uploadAction, uploading] = useActionState(uploadMediaAction, empty)
  const [deleteState, deleteAction, deleting] = useActionState(deleteMediaAction, empty)
  const [pending, startTransition] = useTransition()

  const [folderDraft, setFolderDraft] = useState(folder)
  const [purposeDraft, setPurposeDraft] = useState(purpose)
  const [qDraft, setQDraft] = useState(q)
  const [uploadFolder, setUploadFolder] = useState(folder !== 'all' ? folder : 'general')
  const [uploadPurpose, setUploadPurpose] = useState('photo')

  const busy = uploading || deleting || pending

  React.useEffect(() => {
    if (uploadState.ok) {
      notifySaved(uploadState.message || 'Uploaded.')
      startTransition(() => router.refresh())
    }
  }, [uploadState, router, notifySaved])

  React.useEffect(() => {
    if (deleteState.ok) {
      notifySaved(deleteState.message || 'Deleted.')
      startTransition(() => router.refresh())
    }
  }, [deleteState, router, notifySaved])

  const filterHref = useMemo(() => {
    const params = new URLSearchParams()
    if (folderDraft && folderDraft !== 'all') params.set('folder', folderDraft)
    if (purposeDraft && purposeDraft !== 'all') params.set('purpose', purposeDraft)
    if (qDraft.trim()) params.set('q', qDraft.trim())
    const qs = params.toString()
    return qs ? `/app/admin/media?${qs}` : '/app/admin/media'
  }, [folderDraft, purposeDraft, qDraft])

  return (
    <div className="sf-media-library">
      <div className="sf-media-library-status">
        <p>
          Storage: <strong>{storage.label}</strong>
          {storage.ready ? ' (ready)' : ' (not ready)'}
          {storage.detail ? <span className="layout-muted"> — {storage.detail}</span> : null}
        </p>
        <p className="layout-muted">
          {totalDocs} item{totalDocs === 1 ? '' : 's'}. Payload CMS Media remains the store —{' '}
          <Link href="/admin/collections/media">open in CMS</Link>.
        </p>
      </div>

      <form
        className="sf-media-library-filters"
        onSubmit={(e) => {
          e.preventDefault()
          startTransition(() => router.push(filterHref))
        }}
      >
        <label>
          <span>Folder</span>
          <select value={folderDraft} onChange={(e) => setFolderDraft(e.target.value)}>
            <option value="all">All</option>
            {MEDIA_FOLDERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
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
        <label className="sf-media-library-search">
          <span>Search</span>
          <input
            type="search"
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Alt or filename"
          />
        </label>
        <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-muted" disabled={busy}>
          Filter
        </button>
      </form>

      <form className="sf-media-library-upload" action={uploadAction}>
        <h3>Upload</h3>
        <p className="layout-muted">
          Mobile-friendly: use the file control to pick from gallery or camera. Photos convert to
          WebP; PNG logos stay PNG. Max edge {2560}px.
        </p>
        <div className="sf-media-library-upload-row">
          <label>
            <span>File</span>
            <input type="file" name="file" accept="image/*" capture="environment" required disabled={!storage.ready} />
          </label>
          <label>
            <span>Alt text</span>
            <input type="text" name="alt" placeholder="Describe the image" required />
          </label>
          <label>
            <span>Folder</span>
            <select
              name="folder"
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
            >
              {MEDIA_FOLDERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
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
          <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={busy || !storage.ready}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
        {uploadState.error ? (
          <p className="form-error" role="alert">
            {uploadState.error}
          </p>
        ) : null}
      </form>

      <div className="sf-media-library-grid">
        {initialDocs.length === 0 ? (
          <p className="layout-muted">No media in this filter. Upload above to start the library.</p>
        ) : null}
        {initialDocs.map((doc) => {
          const thumb = doc.sizes?.thumbnail || doc.url
          return (
            <article key={doc.id} className="sf-media-library-card">
              <div className="sf-media-library-thumb">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={doc.alt || doc.filename || 'Media'} />
                ) : (
                  <span>No preview</span>
                )}
              </div>
              <div className="sf-media-library-card-body">
                <strong>{doc.alt || doc.filename || doc.id}</strong>
                <code title="Payload Media id">{doc.id}</code>
                <span className="layout-muted">
                  {[doc.folder, doc.purpose].filter(Boolean).join(' · ') || '—'}
                </span>
                {doc.url ? (
                  <a href={doc.url} target="_blank" rel="noreferrer">
                    Open file
                  </a>
                ) : null}
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={doc.id} />
                  <button
                    type="submit"
                    className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                    disabled={busy}
                    onClick={(e) => {
                      if (!confirm('Delete this media item?')) e.preventDefault()
                    }}
                  >
                    Delete
                  </button>
                </form>
              </div>
            </article>
          )
        })}
      </div>

      {deleteState.error ? (
        <p className="form-error" role="alert">
          {deleteState.error}
        </p>
      ) : null}
    </div>
  )
}
