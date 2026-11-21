'use client'

import React, { useActionState } from 'react'

import {
  acceptFriendAction,
  declineFriendAction,
  requestFriendAction,
  type SocialPeopleActionState,
} from '../actions'

const initial: SocialPeopleActionState = {}

export function RequestFriendButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(requestFriendAction, initial)
  return (
    <form action={action} className="sf-social-people-action">
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="gantry-btn" disabled={pending}>
        {pending ? 'Sending…' : 'Add friend'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function IncomingRequestActions({ userId }: { userId: string }) {
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptFriendAction, initial)
  const [declineState, declineAction, declinePending] = useActionState(
    declineFriendAction,
    initial,
  )
  const error = acceptState.error || declineState.error
  return (
    <div className="sf-social-people-incoming-actions admin-control-row">
      <form action={acceptAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          className="gantry-btn gantry-btn-primary"
          disabled={acceptPending || declinePending}
        >
          {acceptPending ? 'Accepting…' : 'Accept'}
        </button>
      </form>
      <form action={declineAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          className="gantry-btn"
          disabled={acceptPending || declinePending}
        >
          {declinePending ? 'Declining…' : 'Decline'}
        </button>
      </form>
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
