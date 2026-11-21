'use client'

import React, { useActionState } from 'react'

import {
  createSharePostAction,
  type SocialFeedActionState,
} from '../actions'

const initial: SocialFeedActionState = {}

/** Share control on a feed / permalink card. Challenge posts stay unshareable server-side. */
export function SharePostActions({
  postId,
  postKind,
}: {
  postId: string
  postKind: string
}) {
  const [state, formAction, pending] = useActionState(createSharePostAction, initial)

  if (postKind === 'challenge' || postKind === 'share') {
    return null
  }

  return (
    <form action={formAction} className="sf-social-share-actions admin-control-row">
      <input type="hidden" name="sharedPostId" value={postId} />
      <input type="hidden" name="audience" value="friends" />
      <label className="settings-field">
        <span className="sr-only">Note on the share</span>
        <input
          type="text"
          name="body"
          maxLength={2000}
          placeholder="Add a note when you share"
          disabled={pending}
        />
      </label>
      <button type="submit" className="gantry-btn" disabled={pending}>
        {pending ? 'Sharing…' : 'Share'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="admin-inline-ok" role="status">
          Shared.
        </p>
      ) : null}
    </form>
  )
}
