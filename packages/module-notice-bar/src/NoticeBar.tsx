'use client'

import React, { useEffect, useState } from 'react'

const STORAGE_KEY = 'sf-notice-bar-dismissed'

type Props = {
  message: string
  /** Shown next to the message (optional). */
  title?: string
}

/**
 * Dismissible site notice — client-only dismiss via sessionStorage so a refresh
 * in the same tab keeps it closed; a new browser session shows it again.
 */
export function NoticeBar({ message, title = 'Notice' }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === '1') return
    } catch {
      // Private mode / blocked storage — still show the bar.
    }
    setVisible(true)
  }, [])

  if (!visible) return null

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  return (
    <div className="sf-notice-bar" role="region" aria-label={title}>
      <div className="sf-notice-bar-inner">
        <p className="sf-notice-bar-text">
          <strong>{title}.</strong> {message}
        </p>
        <button type="button" className="sf-notice-bar-dismiss" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
