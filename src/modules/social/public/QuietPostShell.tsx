'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from 'react'

import { hidePostAction, unhidePostAction } from '../actions'

const HideContext = createContext<(() => void) | null>(null)

/** Hide this post for the viewer (server persist + undo banner). */
export function useQuietHidePost(): () => void {
  const hide = useContext(HideContext)
  return hide ?? (() => undefined)
}

/**
 * Wraps a feed card so ··· Hide this post persists for the viewer and offers
 * a small Undo. Does not affect anyone else’s feed.
 */
export function QuietPostShell({
  postId,
  children,
}: {
  postId: string
  children: ReactNode
}) {
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const hide = useCallback(() => {
    setError(null)
    const fd = new FormData()
    fd.set('postId', postId)
    startTransition(() => {
      void hidePostAction({}, fd).then((result) => {
        if (result.error) {
          setError(result.error)
          return
        }
        setHidden(true)
      })
    })
  }, [postId])

  const undo = useCallback(() => {
    setError(null)
    const fd = new FormData()
    fd.set('postId', postId)
    startTransition(() => {
      void unhidePostAction({}, fd).then((result) => {
        if (result.error) {
          setError(result.error)
          return
        }
        setHidden(false)
      })
    })
  }, [postId])

  if (hidden) {
    return (
      <div className="sf-social-quiet-undo" role="status">
        <span>Post hidden.</span>
        <button
          type="button"
          className="ghost"
          disabled={pending}
          onClick={undo}
        >
          {pending ? 'Undoing…' : 'Undo'}
        </button>
        {error ? (
          <p className="admin-inline-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <HideContext.Provider value={hide}>
      {children}
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </HideContext.Provider>
  )
}
