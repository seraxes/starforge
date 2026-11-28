'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
} from 'react'
import { createPortal } from 'react-dom'

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
import {
  MEDIA_IMAGE_ACCEPT,
  MEDIA_IMAGE_MIME,
  createFileDropHandlers,
  firstAcceptedImageFile,
} from './media-drop'

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
  /** When false, omit the inline thumbnail (parent shows its own list / frame). */
  showPreview?: boolean
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
 * the shared Media pipeline, or re-use one of your own earlier uploads via a
 * library popup. Optional social-style frame editor (pan + zoom) when
 * `onFrameChange` is provided.
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
  showPreview = true,
}: MemberMediaPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const decodeId = useId()
  const resizeId = useId()
  const libraryTitleId = useId()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [own, setOwn] = useState<ResolvedMedia[]>([])
  const [loading, startLoading] = useTransition()
  const [editorOpen, setEditorOpen] = useState(false)
  const [portal, setPortal] = useState<HTMLElement | null>(null)
  const [encodePolicy, setEncodePolicy] = useState<MediaEncodePolicy>({
    canChooseDecode: canChooseDecodeProp ?? false,
    canChooseResize: canChooseResizeProp ?? false,
  })
  const [decodeToWebp, setDecodeToWebp] = useState(true)
  const [resize, setResize] = useState(true)
  const [dropTarget, setDropTarget] = useState<'actions' | 'library' | null>(null)

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
      // All of this member's uploads — context only tags new uploads.
      const res = await listMemberMediaAction()
      if (res.error) {
        setError(res.error)
        return
      }
      setOwn(res.docs ?? [])
    })
  }, [])

  useEffect(() => {
    if (!libraryOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setLibraryOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [libraryOpen])

  function selectMedia(mediaId: string) {
    onChange(mediaId)
    setLibraryOpen(false)
    if (framing) {
      onFrameChange?.(DEFAULT_IMAGE_FRAME)
      if (mediaId) setEditorOpen(true)
    }
  }

  function openLibrary() {
    setError(null)
    setPortal(
      (typeof document !== 'undefined' &&
        ((document.querySelector('.admin-shell') as HTMLElement | null) ||
          document.body)) ||
        null,
    )
    setLibraryOpen(true)
    loadOwn()
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!MEDIA_IMAGE_MIME.has((file.type || '').toLowerCase())) {
      setError('Use a PNG, JPEG, GIF, or WebP image.')
      return
    }
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
      if (libraryOpen) loadOwn()
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function onDroppedFiles(files: FileList) {
    const file = firstAcceptedImageFile(files, MEDIA_IMAGE_MIME)
    if (!file) {
      setError('Use a PNG, JPEG, GIF, or WebP image.')
      return
    }
    void onFile(file)
  }

  const busy = disabled || uploading
  const actionsDrop = createFileDropHandlers({
    disabled: busy,
    onDraggingChange: (dragging) => setDropTarget(dragging ? 'actions' : null),
    onFiles: onDroppedFiles,
  })
  const libraryDrop = createFileDropHandlers({
    disabled: busy,
    onDraggingChange: (dragging) => setDropTarget(dragging ? 'library' : null),
    onFiles: onDroppedFiles,
  })

  const libraryDialog =
    libraryOpen && portal
      ? createPortal(
          <div
            className="sf-member-media-library-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={libraryTitleId}
            onClick={(event) => {
              if (event.target === event.currentTarget) setLibraryOpen(false)
            }}
          >
            <div
              className={[
                'sf-member-media-library-dialog',
                'sf-media-dropzone',
                dropTarget === 'library' ? 'is-dragging' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              {...libraryDrop}
            >
              <header className="sf-member-media-library-head">
                <h3 id={libraryTitleId}>Choose from library</h3>
                <button
                  type="button"
                  className={btnClass(chrome, 'ghost')}
                  onClick={() => setLibraryOpen(false)}
                >
                  Close
                </button>
              </header>
              <p className="settings-hint sf-member-media-library-hint">
                Your uploads from this site. Pick one to attach, or drop / upload a new image.
              </p>
              <div
                className="sf-member-media-grid sf-member-media-library-grid"
                data-pending={loading || uploading ? '1' : '0'}
              >
                {own.length === 0 && !loading ? (
                  <p className="settings-hint sf-member-media-library-empty">
                    {uploading
                      ? 'Uploading…'
                      : 'Drop an image here, or upload one from the form first.'}
                  </p>
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
            </div>
          </div>,
          portal,
        )
      : null

  return (
    <div className={`sf-member-media sf-member-media--${shape}`}>
      <span className="sf-member-media-label">{label}</span>
      {showPreview ? (
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
      ) : null}
      <div
        className={[
          'sf-member-media-actions',
          'sf-media-dropzone',
          dropTarget === 'actions' ? 'is-dragging' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        {...actionsDrop}
      >
        <input
          ref={fileRef}
          type="file"
          accept={MEDIA_IMAGE_ACCEPT}
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
          aria-haspopup="dialog"
          aria-expanded={libraryOpen}
          onClick={openLibrary}
        >
          Choose from library
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
      <small className="field-hint">
        {hint ??
          `Drop a PNG, JPEG, GIF or WebP (up to ${maxMb} MB), or choose from your library.${framing ? ' Use Adjust to set the visible area.' : ''}`}
      </small>
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
      {libraryDialog}
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
