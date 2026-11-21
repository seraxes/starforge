'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'sf-social-hidden-items'

function readHidden(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((value): value is string => typeof value === 'string'))
  } catch {
    return new Set()
  }
}

function writeHidden(ids: Set<string>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    /* private mode / quota — hide still works for this view */
  }
}

const HideContext = createContext<(() => void) | null>(null)

/** Hide this post/comment for the viewer (local, until they clear site data). */
export function useHideItem(): () => void {
  const hide = useContext(HideContext)
  return hide ?? (() => undefined)
}

/**
 * Wraps a feed card or comment so ··· Hide can remove it from this viewer’s UI.
 * Keys are stable (`post:…` / `comment:…`) and stored in localStorage.
 */
export function HideableShell({
  itemKey,
  children,
}: {
  itemKey: string
  children: ReactNode
}) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    setHidden(readHidden().has(itemKey))
  }, [itemKey])

  const hide = useCallback(() => {
    const next = readHidden()
    next.add(itemKey)
    writeHidden(next)
    setHidden(true)
  }, [itemKey])

  if (hidden) return null

  return <HideContext.Provider value={hide}>{children}</HideContext.Provider>
}
