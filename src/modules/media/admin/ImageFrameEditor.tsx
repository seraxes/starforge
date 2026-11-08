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

/**
 * Social-style pan + zoom crop dialog.
 * Drag to pan across the full image (top/left reachable at 0); zoom enlarges
 * the cover. Saves `{ x, y, zoom }` — no new Media file.
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
  const [frame, setFrame] = useState<ImageFrame>(() =>
    normalizeImageFrame(value ?? DEFAULT_IMAGE_FRAME),
  )
  const [portal, setPortal] = useState<HTMLElement | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    origin: ImageFrame
    overflowX: number
    overflowY: number
  } | null>(null)

  useEffect(() => {
    if (!open) return
    setFrame(normalizeImageFrame(value ?? DEFAULT_IMAGE_FRAME))
    setNat(null)
  }, [open, value, src])

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

  useLayoutEffect(() => {
    if (!open) return
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, shape])

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

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || !layout) return
    const el = stageRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: frame,
      overflowX: layout.overflowX,
      overflowY: layout.overflowY,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    setFrame(
      panImageFrame(
        d.origin,
        { dx: e.clientX - d.startX, dy: e.clientY - d.startY },
        { overflowX: d.overflowX, overflowY: d.overflowY },
      ),
    )
  }

  function onPointerUp(e: React.PointerEvent) {
    if (drag.current?.pointerId === e.pointerId) drag.current = null
  }

  if (!open || !portal) return null

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
          Drag to reposition — you can reach every edge of the photo. Zoom to fill
          more. Only the area inside the
          {shape === 'circle' ? ' circle' : ' outline'} is shown.
        </p>

        <div
          ref={stageRef}
          className={`sf-image-frame-stage sf-image-frame-stage--${shape}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setNat({ w: img.naturalWidth, h: img.naturalHeight })
              }
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
            onChange={(e) =>
              setFrame((prev) =>
                normalizeImageFrame({ ...prev, zoom: Number(e.target.value) }),
              )
            }
          />
        </label>

        <div className="page-settings-actions sf-image-frame-actions">
          <button type="button" className={btn(chrome, 'muted')} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={btn(chrome, 'muted')}
            onClick={() => setFrame({ ...DEFAULT_IMAGE_FRAME })}
          >
            Reset
          </button>
          <button
            type="button"
            className={btn(chrome, 'save')}
            onClick={() => onApply(normalizeImageFrame(frame))}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    portal,
  )
}
