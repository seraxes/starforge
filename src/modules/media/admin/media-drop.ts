/**
 * Shared file-drop helpers for MediaPicker / MemberMediaPicker / MediaFileField.
 * One drop contract for every media bind field in Starforge.
 */

import type { DragEvent } from 'react'

export const MEDIA_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'

/** Raster types accepted on the member upload path. */
export const MEDIA_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
])

/** First image file from a drop / file picker (optional strict mime set). */
export function firstAcceptedImageFile(
  files: FileList | null | undefined,
  allowed?: ReadonlySet<string>,
): File | undefined {
  if (!files?.length) return undefined
  for (const file of Array.from(files)) {
    const mime = (file.type || '').toLowerCase()
    if (allowed) {
      if (allowed.has(mime)) return file
      continue
    }
    if (mime.startsWith('image/')) return file
  }
  return undefined
}

export type FileDropHandlers = {
  onDragEnter: (event: DragEvent) => void
  onDragOver: (event: DragEvent) => void
  onDragLeave: (event: DragEvent) => void
  onDrop: (event: DragEvent) => void
}

/** Drag/drop handlers that forward dropped files to `onFiles`. */
export function createFileDropHandlers(options: {
  disabled?: boolean
  onDraggingChange?: (dragging: boolean) => void
  onFiles: (files: FileList) => void
}): FileDropHandlers {
  const { disabled, onDraggingChange, onFiles } = options
  return {
    onDragEnter: (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (!disabled) onDraggingChange?.(true)
    },
    onDragOver: (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (!disabled) onDraggingChange?.(true)
    },
    onDragLeave: (event) => {
      event.preventDefault()
      event.stopPropagation()
      const next = event.relatedTarget as Node | null
      if (next && event.currentTarget.contains(next)) return
      onDraggingChange?.(false)
    },
    onDrop: (event) => {
      event.preventDefault()
      event.stopPropagation()
      onDraggingChange?.(false)
      if (disabled) return
      const files = event.dataTransfer.files
      if (files?.length) onFiles(files)
    },
  }
}
