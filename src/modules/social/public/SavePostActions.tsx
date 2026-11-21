'use client'

import React, { useActionState } from 'react'

import {
  savePostAction,
  unsavePostAction,
  type SocialSaveActionState,
} from '../actions'

const initial: SocialSaveActionState = {}

/** Save / unsave control on a feed or permalink card. */
export function SavePostActions({
  postId,
  saved,
}: {
  postId: string
  saved: boolean
}) {
  const [state, formAction, pending] = useActionState(
    saved ? unsavePostAction : savePostAction,
    initial,
  )

  return (
    <form action={formAction} className="sf-social-save-actions">
      <input type="hidden" name="postId" value={postId} />
      <button
        type="submit"
        className={saved ? 'ghost is-selected' : 'ghost'}
        aria-pressed={saved}
        disabled={pending}
      >
        {pending ? (saved ? 'Removing…' : 'Saving…') : saved ? 'Saved' : 'Save'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
