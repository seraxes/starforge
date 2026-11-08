'use client'

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  DEFAULT_IMAGE_FRAME,
  IMAGE_FRAME_ZOOM_MAX,
  IMAGE_FRAME_ZOOM_MIN,
  computeImageFrameLayout,
  imageFrameLayoutStyle,
  normalizeImageFrame,
  panImageFrame,
  type ImageFrame,
  type ImageFrameLayout,
  type ImageFrameShape,
} from '../image-frame'

export type ImageFrameEditorProps = {
  open: boolean
  src: string
  /** Current crop (defaults to center). */
  value?: ImageFrame | null
  shape?: ImageFrameShape
  title?: string
  /** `public` = site buttons; `admin` = Gantry. */
  chrome?: 'public' | 'admin'
  onApply: (frame: ImageFrame) => void
  onCancel: () => void
}

function btn(chrome: 'public' | 'admin', kind: 'save' | 'muted'): string {
  if (chrome === 'admin') {
    return kind === 'save'
      ? 'gantry-toolbar-btn gantry-toolbar-btn-save'
      : 'gantry-toolbar-btn gantry-toolbar-btn-muted'
  }
  return kind === 'save' ? 'primary' : 'ghost'
}

function readNaturalSize(img: HTMLImageElement | null): { w: number; h: number } | null {
  if (!img || img.naturalWidth <= 0 || img.naturalHeight <= 0) return null
  return { w: img.naturalWidth, h: img.naturalHeight }
}

/**
 * Social-style pan + zoom crop dialog.
 * Drag to pan across the full image; zoom enlarges the cover.
 */
export function ImageFrameEditor({
  open,
  src,
  value,
  shape = 'square',
  title = 'Adjust image',
  chrome = 'public',
  onApply,
  onCancel,
}: ImageFrameEditorProps) {
  const titleId = useId()
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const frameRef = useRef<ImageFrame>(normalizeImageFrame(value ?? DEFAULT_IMAGE_FRAME))
  const layoutRef = useRef<ImageFrameLayout | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    origin: ImageFrame
    overflowX: number
    overflowY: number
  } | null>(null)

  const [frame, setFrame] = useState<ImageFrame>(() =>
    normalizeImageFrame(value ?? DEFAULT_IMAGE_FRAME),
  )
  const [portal, setPortal] = useState<HTMLElement | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)

  frameRef.current = frame

  // Sync opening value once per open — do not clear natural size on every parent re-render.
  useEffect(() => {
    if (!open) return
    setFrame(normalizeImageFrame(value ?? DEFAULT_IMAGE_FRAME))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps -- intentionally ignore `value` identity churn

  useEffect(() => {
    if (!open) return
    setPortal(
      (document.querySelector('.admin-shell') as HTMLElement | null) || document.body,
    )
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  // New src → re-read dimensions (cached images often skip onLoad).
  useLayoutEffect(() => {
    if (!open) return
    setNat(readNaturalSize(imgRef.current))
  }, [open, src])

  useLayoutEffect(() => {
    if (!open) return
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, shape, portal])

  const layout =
    box && nat
      ? computeImageFrameLayout({
          frameW: box.w,
          frameH: box.h,
          natW: nat.w,
          natH: nat.h,
          frame,
        })
      : null
  layoutRef.current = layout

  function endDrag(pointerId?: number) {
    const d = dragRef.current
    if (!d) return
    if (pointerId != null && d.pointerId !== pointerId) return
    dragRef.current = null
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const current = layoutRef.current
    if (!current) return
    e.preventDefault()
    const el = stageRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: frameRef.current,
      overflowX: Math.max(current.overflowX, 0),
      overflowY: Math.max(current.overflowY, 0),
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current
    if (!d || d.pointerId !== e.pointerId) return
    e.preventDefault()
    const next = panImageFrame(
      d.origin,
      { dx: e.clientX - d.startX, dy: e.clientY - d.startY },
      { overflowX: d.overflowX, overflowY: d.overflowY },
    )
    frameRef.current = next
    setFrame(next)
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    endDrag(e.pointerId)
  }

  if (!open || !portal) return null

  const canDrag = Boolean(layout && (layout.overflowX > 0.5 || layout.overflowY > 0.5))

  return createPortal(
    <div
      className="sf-image-frame-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="sf-image-frame-dialog">
        <header className="sf-image-frame-head">
          <h3 id={titleId}>{title}</h3>
          <button type="button" className={btn(chrome, 'muted')} onClick={onCancel}>
            Close
          </button>
        </header>

        <p className="settings-hint sf-image-frame-hint">
          Drag the photo to reposition. Zoom in if you need more room to pan. Only the area
          inside the{shape === 'circle' ? ' circle' : ' outline'} is shown.
        </p>

        <div
          ref={stageRef}
          className={`sf-image-frame-stage sf-image-frame-stage--${shape}${canDrag ? '' : ' is-loading'}`}
          style={{ touchAction: 'none', cursor: canDrag ? 'grab' : 'default' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={() => endDrag()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const size = readNaturalSize(e.currentTarget)
              if (size) setNat(size)
            }}
            style={
              layout
                ? imageFrameLayoutStyle(layout)
                : {
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }
            }
          />
          <div className="sf-image-frame-mask" aria-hidden="true" />
        </div>

        <label className="settings-field sf-image-frame-zoom">
          <span>Zoom</span>
          <input
            type="range"
            min={IMAGE_FRAME_ZOOM_MIN}
            max={IMAGE_FRAME_ZOOM_MAX}
            step={0.01}
            value={frame.zoom}
            onChange={(e) => {
              const next = normalizeImageFrame({
                ...frameRef.current,
                zoom: Number(e.target.value),
              })
              frameRef.current = next
              setFrame(next)
            }}
          />
        </label>

        <div className="page-settings-actions sf-image-frame-actions">
          <button type="button" className={btn(chrome, 'muted')} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={btn(chrome, 'muted')}
            onClick={() => {
              const next = { ...DEFAULT_IMAGE_FRAME }
              frameRef.current = next
              setFrame(next)
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className={btn(chrome, 'save')}
            onClick={() => onApply(normalizeImageFrame(frameRef.current))}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    portal,
  )
}
