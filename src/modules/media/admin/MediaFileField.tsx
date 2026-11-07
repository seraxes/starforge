'use client'

import React, { useId, useRef, useState } from 'react'

type Props = {
  /** Form field name (default `file`). */
  name?: string
  disabled?: boolean
  /** Optional class on the outer drop zone. */
  className?: string
  accept?: string
}

/**
 * Visible Choose-image control + drop zone for Media upload forms.
 * Avoids silent HTML5 `required` / opaque native file controls.
 */
export function MediaFileField({
  name = 'file',
  disabled,
  className = '',
  accept = 'image/*',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)

  function applyFiles(files: FileList | null) {
    const input = inputRef.current
    if (!input || !files?.length) {
      setFileName('')
      return
    }
    const dt = new DataTransfer()
    dt.items.add(files[0]!)
    input.files = dt.files
    setFileName(files[0]!.name)
  }

  return (
    <div
      className={[
        'sf-media-file-field',
        dragging ? 'is-dragging' : '',
        fileName ? 'has-file' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      onDragEnter={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) setDragging(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragging(false)
        if (disabled) return
        applyFiles(e.dataTransfer.files)
      }}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        disabled={disabled}
        className="sf-media-file-field-input"
        onChange={(e) => applyFiles(e.target.files)}
      />
      <div className="sf-media-file-field-body">
        <p className="sf-media-file-field-title">
          {fileName ? fileName : 'Drop an image here, or choose a file'}
        </p>
        <p className="sf-media-file-field-hint settings-hint">
          Images only (JPEG, PNG, WebP, GIF…).
        </p>
        <button
          type="button"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {fileName ? 'Change file' : 'Choose image…'}
        </button>
      </div>
    </div>
  )
}
