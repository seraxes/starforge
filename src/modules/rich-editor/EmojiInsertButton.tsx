'use client'

import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
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

const PANEL_WIDTH = 352
const PANEL_HEIGHT = 432
const GAP = 8
const EDGE = 12

type PanelCoords = { top: number; left: number; width: number }

function placePanel(anchor: DOMRect): PanelCoords {
  const width = Math.min(PANEL_WIDTH, window.innerWidth - EDGE * 2)
  const height = Math.min(PANEL_HEIGHT, window.innerHeight - EDGE * 2)

  let left = anchor.right - width
  if (left < EDGE) left = EDGE
  if (left + width > window.innerWidth - EDGE) {
    left = Math.max(EDGE, window.innerWidth - EDGE - width)
  }

  const spaceAbove = anchor.top - EDGE
  const spaceBelow = window.innerHeight - anchor.bottom - EDGE
  let top: number
  if (spaceAbove >= height + GAP || spaceAbove >= spaceBelow) {
    top = anchor.top - GAP - height
  } else {
    top = anchor.bottom + GAP
  }
  if (top < EDGE) top = EDGE
  if (top + height > window.innerHeight - EDGE) {
    top = Math.max(EDGE, window.innerHeight - EDGE - height)
  }

  return { top, left, width }
}

/**
 * Facebook-style emoji insert control for text inputs / textareas.
 * Categories, search, skin tones, and recents come from emoji-picker-react.
 * Inserts native Unicode (no sprite CDN for stored content).
 * Panel portals to document.body so feed/card overflow cannot clip it.
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
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  /** Stays true after first open so the picker mounts once (lazy). */
  const [pickerReady, setPickerReady] = useState(false)
  const [coords, setCoords] = useState<PanelCoords | null>(null)
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  const updatePlace = useCallback(() => {
    const anchor = rootRef.current?.getBoundingClientRect()
    if (!anchor) return
    setCoords(placePanel(anchor))
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePlace()
  }, [open, updatePlace])

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current
      const panel = panelRef.current
      const target = event.target
      if (!(target instanceof Node)) return
      if (root?.contains(target) || panel?.contains(target)) return
      setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }

    function onReposition() {
      updatePlace()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updatePlace])

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

  const panelStyle: CSSProperties | undefined = coords
    ? {
        top: coords.top,
        left: coords.left,
        width: coords.width,
      }
    : undefined

  const panel =
    open && pickerReady && portalTarget && coords ? (
      createPortal(
        <div
          ref={panelRef}
          id={panelId}
          className="sf-emoji-insert-panel is-portaled"
          role="dialog"
          aria-label="Emoji picker"
          style={panelStyle}
        >
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            emojiStyle={EmojiStyle.NATIVE}
            theme={Theme.LIGHT}
            width="100%"
            height={PANEL_HEIGHT}
            lazyLoadEmojis
            previewConfig={{ showPreview: false }}
            skinTonesDisabled={false}
          />
        </div>,
        portalTarget,
      )
    ) : null

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
      {panel}
    </div>
  )
}
