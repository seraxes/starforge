'use client'

import React, { useActionState, useRef } from 'react'

import {
  createSharePostAction,
  type SocialFeedActionState,
} from '../actions'
import { SocialEmojiInsertButton } from './SocialEmojiInsert'

const initial: SocialFeedActionState = {}

/**
 * Share note under a post. Challenge posts stay refused on the server.
 * When the card is already a share, pass the original post id.
 */
export function SharePostActions({
  postId,
  noteOnly = false,
}: {
  /** Post id that lands in sharedPostId (original when resharing a share). */
  postId: string
  /** The post action bar already has Share. This form is only the note. */
  noteOnly?: boolean
}) {
  const [state, formAction, pending] = useActionState(createSharePostAction, initial)
  const bodyRef = useRef<HTMLInputElement>(null)

  return (
    <form
      action={formAction}
      className={noteOnly ? 'sf-social-share-note' : 'sf-social-share-actions admin-control-row'}
    >
      <input type="hidden" name="sharedPostId" value={postId} />
      <input type="hidden" name="audience" value="friends" />
      {noteOnly ? (
        <input
          ref={bodyRef}
          type="text"
          name="body"
          className="sf-social-comment-input"
          maxLength={2000}
          placeholder="Say something about this…"
          disabled={pending}
          aria-label="Note on the share"
        />
      ) : (
        <label className="settings-field">
          <span className="sr-only">Note on the share</span>
          <input
            ref={bodyRef}
            type="text"
            name="body"
            maxLength={2000}
            placeholder="Add a note when you share"
            disabled={pending}
          />
        </label>
      )}
      <SocialEmojiInsertButton disabled={pending} targetRef={bodyRef} />
      <button
        type="submit"
        className={noteOnly ? 'sf-social-btn' : 'sf-social-btn sf-social-btn-primary'}
        disabled={pending}
      >
        {pending ? 'Sharing…' : noteOnly ? 'Post' : 'Share'}
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
