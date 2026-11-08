'use client'

/**
 * Display-only framed image — cover-pan layout shared with ImageFrameEditor.
 */

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
  label?: string
}

export function FramedImage({
  src,
  alt = '',
  frame,
  shape = 'square',
  className = '',
  label,
}: FramedImageProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
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

  // Cached images often skip onLoad — read natural size after mount / src change.
  useLayoutEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth > 0) {
      setNat({ w: img.naturalWidth, h: img.naturalHeight })
    }
  }, [src])

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
        ref={imgRef}
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
