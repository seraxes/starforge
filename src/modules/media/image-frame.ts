/**
 * Shared image-frame / crop model (social-style pan + zoom).
 *
 * `{ x, y }` = pan progress 0–100 across the overflow (0 = show top/left edge,
 * 100 = show bottom/right). `zoom` multiplies the cover scale (1 = just covers).
 * Layout is absolute left/top — not object-position + CSS scale (that couldn't
 * reach the image edges).
 */

export type ImageFrameShape = 'circle' | 'square' | 'wide'

/** Normalized crop: pan (0–100) + zoom (1–3). */
export type ImageFrame = {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_IMAGE_FRAME: ImageFrame = { x: 50, y: 50, zoom: 1 }

export const IMAGE_FRAME_ZOOM_MIN = 1
export const IMAGE_FRAME_ZOOM_MAX = 3

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

export function normalizeImageFrame(raw: unknown): ImageFrame {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_IMAGE_FRAME }
  }
  const row = raw as Record<string, unknown>
  return {
    x: clamp(Number(row.x), 0, 100),
    y: clamp(Number(row.y), 0, 100),
    zoom: clamp(Number(row.zoom), IMAGE_FRAME_ZOOM_MIN, IMAGE_FRAME_ZOOM_MAX),
  }
}

export function parseImageFrameJson(raw: unknown): ImageFrame {
  if (typeof raw === 'string') {
    try {
      return normalizeImageFrame(JSON.parse(raw))
    } catch {
      return { ...DEFAULT_IMAGE_FRAME }
    }
  }
  return normalizeImageFrame(raw)
}

export type ImageFrameLayout = {
  /** Drawn image width (px). */
  width: number
  /** Drawn image height (px). */
  height: number
  /** Offset from frame left (≤ 0). */
  left: number
  /** Offset from frame top (≤ 0). */
  top: number
  overflowX: number
  overflowY: number
}

/**
 * Cover-fit the image into the frame, apply zoom, then pan by x/y (0–100).
 * x/y=0 pins the top-left of the image to the frame; 100 pins the bottom-right.
 */
export function computeImageFrameLayout(input: {
  frameW: number
  frameH: number
  natW: number
  natH: number
  frame: ImageFrame
}): ImageFrameLayout | null {
  const { frameW, frameH, natW, natH } = input
  if (
    !(frameW > 0 && frameH > 0 && natW > 0 && natH > 0) ||
    !Number.isFinite(frameW) ||
    !Number.isFinite(frameH) ||
    !Number.isFinite(natW) ||
    !Number.isFinite(natH)
  ) {
    return null
  }
  const f = normalizeImageFrame(input.frame)
  const cover = Math.max(frameW / natW, frameH / natH)
  const scale = cover * f.zoom
  const width = natW * scale
  const height = natH * scale
  const overflowX = Math.max(0, width - frameW)
  const overflowY = Math.max(0, height - frameH)
  // Avoid `-0` from `-* * 0` (breaks Object.is / strictEqual).
  const left = f.x === 0 || overflowX === 0 ? 0 : -overflowX * (f.x / 100)
  const top = f.y === 0 || overflowY === 0 ? 0 : -overflowY * (f.y / 100)
  return {
    width,
    height,
    left,
    top,
    overflowX,
    overflowY,
  }
}

/** Convert a pixel pan delta into a new frame (natural drag feel at any zoom). */
export function panImageFrame(
  frame: ImageFrame,
  deltaPx: { dx: number; dy: number },
  overflow: { overflowX: number; overflowY: number },
): ImageFrame {
  const f = normalizeImageFrame(frame)
  const nextX =
    overflow.overflowX > 0.5
      ? f.x - (deltaPx.dx / overflow.overflowX) * 100
      : f.x
  const nextY =
    overflow.overflowY > 0.5
      ? f.y - (deltaPx.dy / overflow.overflowY) * 100
      : f.y
  return normalizeImageFrame({ ...f, x: nextX, y: nextY })
}

/** Inline style for a positioned `<img>` after `computeImageFrameLayout`. */
export function imageFrameLayoutStyle(
  layout: ImageFrameLayout,
): {
  position: 'absolute'
  width: number
  height: number
  left: number
  top: number
  maxWidth: 'none'
  maxHeight: 'none'
} {
  return {
    position: 'absolute',
    width: layout.width,
    height: layout.height,
    left: layout.left,
    top: layout.top,
    maxWidth: 'none',
    maxHeight: 'none',
  }
}
