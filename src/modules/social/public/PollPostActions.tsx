'use client'

import React, { useActionState } from 'react'

import {
  closePollAction,
  votePollAction,
  type SocialPollActionState,
} from '../actions'
import type { PollOption } from '../posts'

const initial: SocialPollActionState = {}

/** Vote / close controls on a poll post card. */
export function PollPostActions({
  postId,
  options,
  closed,
  isAuthor,
  viewerOptionId,
}: {
  postId: string
  options: PollOption[]
  closed: boolean
  isAuthor: boolean
  viewerOptionId?: string | null
}) {
  const [voteState, voteAction, votePending] = useActionState(votePollAction, initial)
  const [closeState, closeAction, closePending] = useActionState(closePollAction, initial)
  const pending = votePending || closePending

  return (
    <div className="sf-social-poll">
      <ul className="sf-social-poll-options">
        {options.map((opt) => (
          <li key={opt.id} className="admin-control-row sf-social-poll-option">
            {closed ? (
              <span>
                {opt.label}
                {viewerOptionId === opt.id ? ' (your vote)' : ''}
              </span>
            ) : (
              <form action={voteAction}>
                <input type="hidden" name="postId" value={postId} />
                <input type="hidden" name="optionId" value={opt.id} />
                <button
                  type="submit"
                  className="sf-social-btn"
                  disabled={pending}
                  aria-pressed={viewerOptionId === opt.id}
                >
                  {viewerOptionId === opt.id ? `✓ ${opt.label}` : opt.label}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {closed ? (
        <p className="settings-hint">Poll closed</p>
      ) : isAuthor ? (
        <form action={closeAction} className="admin-control-row">
          <input type="hidden" name="postId" value={postId} />
          <button type="submit" className="sf-social-btn" disabled={pending}>
            Close poll
          </button>
        </form>
      ) : null}
      {voteState.error || closeState.error ? (
        <p className="admin-inline-error" role="alert">
          {voteState.error || closeState.error}
        </p>
      ) : null}
    </div>
  )
}
