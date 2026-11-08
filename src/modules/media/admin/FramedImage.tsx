'use client'

import React, { useLayoutEffect, useRef, useState } from 'react'

import {
  DEFAULT_IMAGE_FRAME,
  computeImageFrameLayout,
  imageFrameLayoutStyle,
  normalizeImageFrame,
  type ImageFrame,
  type ImageFrameShape,
} from '../image-frame'

export type FramedImageProps = {
  src: string
  alt?: string
  frame?: ImageFrame | null
  shape?: ImageFrameShape
  className?: string
  /** Accessible label for the frame region. */
  label?: string
}

/**
 * Display-only framed image — same cover-pan layout as `ImageFrameEditor`.
 * Measures the container + natural image size so x/y=0 reaches the real top/left.
 */
export function FramedImage({
  src,
  alt = '',
  frame,
  shape = 'square',
  className = '',
  label,
}: FramedImageProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const f = normalizeImageFrame(frame ?? DEFAULT_IMAGE_FRAME)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const layout =
    box && nat
      ? computeImageFrameLayout({
          frameW: box.w,
          frameH: box.h,
          natW: nat.w,
          natH: nat.h,
          frame: f,
        })
      : null

  return (
    <div
      ref={boxRef}
      className={`sf-framed-image sf-framed-image--${shape}${className ? ` ${className}` : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
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
                // Pre-measure fallback (center cover) — replaced once sized.
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: `${f.x}% ${f.y}%`,
              }
        }
      />
    </div>
  )
}
