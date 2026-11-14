'use client'

import React, { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react'

import { getMediaEncodePolicyAction } from '@/core/media/actions'
import type { MediaEncodePolicy } from '@/core/media/pipeline'
import type { ResolvedMedia } from '@/core/media/resolve'

import {
  DEFAULT_IMAGE_FRAME,
  mediaFrameSrc,
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
  /** Override encode policy (otherwise loaded from Media settings for the viewer). */
  canChooseDecode?: boolean
  canChooseResize?: boolean
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
  canChooseDecode: canChooseDecodeProp,
  canChooseResize: canChooseResizeProp,
}: MemberMediaPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const decodeId = useId()
  const resizeId = useId()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [ownOpen, setOwnOpen] = useState(false)
  const [own, setOwn] = useState<ResolvedMedia[]>([])
  const [loading, startLoading] = useTransition()
  const [editorOpen, setEditorOpen] = useState(false)
  const [encodePolicy, setEncodePolicy] = useState<MediaEncodePolicy>({
    canChooseDecode: canChooseDecodeProp ?? false,
    canChooseResize: canChooseResizeProp ?? false,
  })
  const [decodeToWebp, setDecodeToWebp] = useState(true)
  const [resize, setResize] = useState(true)

  const canChooseDecode = canChooseDecodeProp ?? encodePolicy.canChooseDecode
  const canChooseResize = canChooseResizeProp ?? encodePolicy.canChooseResize
  const showEncodeOptions = canChooseDecode || canChooseResize

  // Always the original file for framing — never the square centre-cropped thumbnail.
  const src = value ? mediaFrameSrc(value) : ''
  const framing = Boolean(onFrameChange)
  const currentFrame = normalizeImageFrame(frame ?? DEFAULT_IMAGE_FRAME)

  useEffect(() => {
    if (canChooseDecodeProp != null && canChooseResizeProp != null) return
    let cancelled = false
    void getMediaEncodePolicyAction().then((res) => {
      if (cancelled || 'error' in res) return
      setEncodePolicy(res)
    })
    return () => {
      cancelled = true
    }
  }, [canChooseDecodeProp, canChooseResizeProp])

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

  function selectMedia(mediaId: string) {
    onChange(mediaId)
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
      if (!canChooseDecode || decodeToWebp) formData.set('decodeToWebp', 'on')
      if (!canChooseResize || resize) formData.set('resize', 'on')
      const res = await uploadMemberMediaAction({}, formData)
      if (res.error || !res.media) {
        setError(res.error || 'Upload failed.')
        return
      }
      selectMedia(res.media.id)
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
              onFrameChange?.(DEFAULT_IMAGE_FRAME)
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      {showEncodeOptions ? (
        <div className="sf-member-media-encode" role="group" aria-label="Encode options">
          {canChooseDecode ? (
            <label className="settings-flag" htmlFor={decodeId}>
              <input
                id={decodeId}
                type="checkbox"
                checked={decodeToWebp}
                disabled={busy}
                onChange={(e) => setDecodeToWebp(e.target.checked)}
              />
              <span>Decode to WebP</span>
            </label>
          ) : null}
          {canChooseResize ? (
            <label className="settings-flag" htmlFor={resizeId}>
              <input
                id={resizeId}
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
              onClick={() => selectMedia(doc.id)}
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
