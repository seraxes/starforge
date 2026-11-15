'use client'

import React, { useId, useRef, useState } from 'react'

type Props = {
  /** Form field name (default `file`). */
  name?: string
  disabled?: boolean
  /** Optional class on the outer drop zone. */
  className?: string
  accept?: string
  /** Idle drop-zone title. Default is the image copy used by MediaPicker. */
  titleIdle?: string
  /** Hint under the title. */
  titleHint?: string
  chooseLabel?: string
  changeLabel?: string
  /**
   * Show Decode to WebP beside the drop zone (default checked).
   * When false, a hidden `decodeToWebp=on` is posted so the server default stays on.
   */
  canChooseDecode?: boolean
  /**
   * Show Resize beside the drop zone (default checked).
   * When false, a hidden `resize=on` is posted so the server default stays on.
   */
  canChooseResize?: boolean
}

/**
 * Visible Choose-image control + drop zone for Media upload forms.
 * Optional encode flags sit to the right of the drop zone when the viewer may choose.
 */
export function MediaFileField({
  name = 'file',
  disabled,
  className = '',
  accept = 'image/*',
  titleIdle = 'Drop an image here, or choose a file',
  titleHint = 'Images only (JPEG, PNG, WebP, GIF…).',
  chooseLabel = 'Choose image…',
  changeLabel = 'Change file',
  canChooseDecode = false,
  canChooseResize = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const decodeId = useId()
  const resizeId = useId()
  const [fileName, setFileName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [decodeToWebp, setDecodeToWebp] = useState(true)
  const [resize, setResize] = useState(true)
  const showOptions = canChooseDecode || canChooseResize

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
        'sf-media-file-field-row',
        showOptions ? 'has-encode-options' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'sf-media-file-field',
          dragging ? 'is-dragging' : '',
          fileName ? 'has-file' : '',
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
            {fileName ? fileName : titleIdle}
          </p>
          <p className="sf-media-file-field-hint settings-hint">{titleHint}</p>
          <button
            type="button"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            {fileName ? changeLabel : chooseLabel}
          </button>
        </div>
      </div>

      {showOptions ? (
        <div className="sf-media-file-field-options" role="group" aria-label="Encode options">
          {canChooseDecode ? (
            <label className="settings-flag" htmlFor={decodeId}>
              <input
                id={decodeId}
                type="checkbox"
                name="decodeToWebp"
                value="on"
                checked={decodeToWebp}
                disabled={disabled}
                onChange={(e) => setDecodeToWebp(e.target.checked)}
              />
              <span>Decode to WebP</span>
            </label>
          ) : (
            <input type="hidden" name="decodeToWebp" value="on" />
          )}
          {canChooseResize ? (
            <label className="settings-flag" htmlFor={resizeId}>
              <input
                id={resizeId}
                type="checkbox"
                name="resize"
                value="on"
                checked={resize}
                disabled={disabled}
                onChange={(e) => setResize(e.target.checked)}
              />
              <span>Resize</span>
            </label>
          ) : (
            <input type="hidden" name="resize" value="on" />
          )}
        </div>
      ) : (
        <>
          <input type="hidden" name="decodeToWebp" value="on" />
          <input type="hidden" name="resize" value="on" />
        </>
      )}
    </div>
  )
}
