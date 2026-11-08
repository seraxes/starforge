'use client'

import React, { useCallback, useRef, useState, useTransition } from 'react'

import type { ResolvedMedia } from '@/core/media/resolve'

import {
  DEFAULT_IMAGE_FRAME,
  normalizeImageFrame,
  type ImageFrame,
  type ImageFrameShape,
} from '../image-frame'
import {
  listMemberMediaAction,
  uploadMemberMediaAction,
} from '../member-actions'
import { FramedImage } from './FramedImage'
import { ImageFrameEditor } from './ImageFrameEditor'

export type MemberMediaPickerProps = {
  label: string
  /** Current Payload Media id ('' = none). */
  value: string
  onChange: (mediaId: string) => void
  /** Crop / focus for the visible area (optional — omit when no frame needed). */
  frame?: ImageFrame
  onFrameChange?: (frame: ImageFrame) => void
  /** Upload surface label stored on the ownership ledger (`profile-avatar`, …). */
  context: string
  disabled?: boolean
  hint?: string
  /** Preview + editor shape — avatars are square/circle, covers are wide. */
  shape?: ImageFrameShape
  /** `public` = site buttons; `admin` = Gantry toolbar buttons. */
  chrome?: 'public' | 'admin'
  /** Max MB shown in the hint copy (server enforces the real limit). */
  maxMb?: number
}

function btnClass(chrome: 'public' | 'admin', variant: 'primary' | 'ghost'): string {
  if (chrome === 'admin') {
    return variant === 'primary'
      ? 'gantry-toolbar-btn gantry-toolbar-btn-save'
      : 'gantry-toolbar-btn gantry-toolbar-btn-muted'
  }
  return variant === 'primary' ? 'primary' : 'ghost'
}

/**
 * Inline image control for **members** (non-admins). Upload a new image through
 * the shared Media pipeline, or re-use one of your own earlier uploads. Optional
 * social-style frame editor (pan + zoom) when `onFrameChange` is provided.
 */
export function MemberMediaPicker({
  label,
  value,
  onChange,
  frame,
  onFrameChange,
  context,
  disabled,
  hint,
  shape = 'square',
  chrome = 'public',
  maxMb = 5,
}: MemberMediaPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [ownOpen, setOwnOpen] = useState(false)
  const [own, setOwn] = useState<ResolvedMedia[]>([])
  const [loading, startLoading] = useTransition()
  const [editorOpen, setEditorOpen] = useState(false)

  const src = previewUrl || (value ? `/api/media/${value}` : '')
  const framing = Boolean(onFrameChange)
  const currentFrame = normalizeImageFrame(frame ?? DEFAULT_IMAGE_FRAME)

  const loadOwn = useCallback(() => {
    startLoading(async () => {
      const res = await listMemberMediaAction({ context })
      if (res.error) {
        setError(res.error)
        return
      }
      setOwn(res.docs ?? [])
    })
  }, [context])

  function selectMedia(mediaId: string, url?: string) {
    onChange(mediaId)
    setPreviewUrl(url || (mediaId ? `/api/media/${mediaId}` : ''))
    if (framing) {
      onFrameChange?.(DEFAULT_IMAGE_FRAME)
      if (mediaId) setEditorOpen(true)
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('file', file)
      formData.set('context', context)
      formData.set('alt', label)
      const res = await uploadMemberMediaAction({}, formData)
      if (res.error || !res.media) {
        setError(res.error || 'Upload failed.')
        return
      }
      selectMedia(res.media.id, res.media.url)
      if (ownOpen) loadOwn()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const busy = disabled || uploading

  return (
    <div className={`sf-member-media sf-member-media--${shape}`}>
      <span className="sf-member-media-label">{label}</span>
      <div className="sf-member-media-preview">
        {src ? (
          framing ? (
            <FramedImage src={src} frame={currentFrame} shape={shape} alt="" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" />
          )
        ) : (
          <span className="sf-member-media-empty">No image</span>
        )}
      </div>
      <div className="sf-member-media-actions">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="sf-member-media-file"
          disabled={busy}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          className={btnClass(chrome, 'primary')}
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
        </button>
        {framing && value ? (
          <button
            type="button"
            className={btnClass(chrome, 'ghost')}
            disabled={busy}
            onClick={() => setEditorOpen(true)}
          >
            Adjust
          </button>
        ) : null}
        <button
          type="button"
          className={btnClass(chrome, 'ghost')}
          disabled={busy}
          aria-expanded={ownOpen}
          onClick={() => {
            const next = !ownOpen
            setOwnOpen(next)
            if (next) loadOwn()
          }}
        >
          {ownOpen ? 'Hide my images' : 'My images'}
        </button>
        {value ? (
          <button
            type="button"
            className={btnClass(chrome, 'ghost')}
            disabled={busy}
            onClick={() => {
              onChange('')
              setPreviewUrl('')
              onFrameChange?.(DEFAULT_IMAGE_FRAME)
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      {ownOpen ? (
        <div className="sf-member-media-grid" data-pending={loading ? '1' : '0'}>
          {own.length === 0 && !loading ? (
            <p className="settings-hint">You have not uploaded any images here yet.</p>
          ) : null}
          {own.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className={`sf-member-media-tile${doc.id === value ? ' is-selected' : ''}`}
              disabled={busy}
              onClick={() => selectMedia(doc.id, doc.sizes?.thumbnail || doc.url)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={doc.sizes?.thumbnail || doc.url} alt={doc.alt || ''} />
            </button>
          ))}
        </div>
      ) : null}
      <small className="field-hint">
        {hint ??
          `PNG, JPEG, GIF or WebP, up to ${maxMb} MB.${framing ? ' Use Adjust to set the visible area.' : ''}`}
      </small>
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {framing && src ? (
        <ImageFrameEditor
          open={editorOpen}
          src={src}
          value={currentFrame}
          shape={shape}
          title={`Adjust ${label.toLowerCase()}`}
          chrome={chrome}
          onCancel={() => setEditorOpen(false)}
          onApply={(next) => {
            onFrameChange?.(next)
            setEditorOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
