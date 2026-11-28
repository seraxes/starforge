'use client'

import React, { useCallback, useEffect, useId, useRef, useState, type RefObject } from 'react'
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react'

import { insertTextAtCaret, type TextCaretTarget } from './insert-text-at-caret'

export type EmojiInsertButtonProps = {
  /**
   * Controlled / custom insert. Receives the native emoji string.
   * When omitted, `targetRef` is required and the helper writes into the field.
   */
  onInsert?: (emoji: string) => void
  /** Uncontrolled input/textarea — used when `onInsert` is omitted, or as focus target. */
  targetRef?: RefObject<TextCaretTarget | null>
  disabled?: boolean
  /** Wrapper class (positioning). */
  className?: string
  /** Toggle button class — default `secondary` for public Social chrome. */
  buttonClassName?: string
  'aria-label'?: string
  /** Keep the picker open after an insert (Facebook-style multi-pick). Default true. */
  keepOpenOnInsert?: boolean
}

/**
 * Facebook-style emoji insert control for text inputs / textareas.
 * Categories, search, skin tones, and recents come from emoji-picker-react.
 * Inserts native Unicode (no sprite CDN for stored content).
 */
export function EmojiInsertButton({
  onInsert,
  targetRef,
  disabled = false,
  className,
  buttonClassName = 'secondary',
  'aria-label': ariaLabel = 'Emoji',
  keepOpenOnInsert = true,
}: EmojiInsertButtonProps) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  /** Stays true after first open so the picker mounts once (lazy). */
  const [pickerReady, setPickerReady] = useState(false)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current
      const target = event.target
      if (!root || !(target instanceof Node)) return
      if (root.contains(target)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleEmojiClick = useCallback(
    (data: EmojiClickData) => {
      const emoji = data.emoji
      if (!emoji) return

      if (onInsert) {
        onInsert(emoji)
      } else if (targetRef?.current) {
        insertTextAtCaret(targetRef.current, emoji)
      }

      if (!keepOpenOnInsert) setOpen(false)
    },
    [onInsert, targetRef, keepOpenOnInsert],
  )

  return (
    <div
      ref={rootRef}
      className={['sf-emoji-insert', className].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className={buttonClassName}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => {
          if (!open) setPickerReady(true)
          setOpen(!open)
        }}
      >
        <span className="sf-emoji-insert-glyph" aria-hidden="true">
          😊
        </span>
      </button>
      {open && pickerReady ? (
        <div
          id={panelId}
          className="sf-emoji-insert-panel"
          role="dialog"
          aria-label="Emoji picker"
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            emojiStyle={EmojiStyle.NATIVE}
            theme={Theme.LIGHT}
            width="100%"
            height={360}
            lazyLoadEmojis
            previewConfig={{ showPreview: false }}
            skinTonesDisabled={false}
          />
        </div>
      ) : null}
    </div>
  )
}
