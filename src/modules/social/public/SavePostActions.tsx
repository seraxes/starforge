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
    <form action={formAction} className="sf-social-save-actions admin-control-row">
      <input type="hidden" name="postId" value={postId} />
      <button type="submit" className="gantry-btn" disabled={pending}>
        {pending ? (saved ? 'Removing…' : 'Saving…') : saved ? 'Unsave' : 'Save'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
