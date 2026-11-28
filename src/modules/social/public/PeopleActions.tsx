'use client'

import React, { useActionState } from 'react'
import { useTranslations } from 'next-intl'

import {
  acceptFriendAction,
  declineFriendAction,
  requestFriendAction,
  type SocialPeopleActionState,
} from '../actions'

const initial: SocialPeopleActionState = {}

export function RequestFriendButton({ userId }: { userId: string }) {
  const t = useTranslations('product:social')
  const [state, action, pending] = useActionState(requestFriendAction, initial)
  return (
    <form action={action} className="sf-social-people-action">
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="sf-social-people-btn" disabled={pending}>
        {pending ? t('sendingFriendRequest') : t('addFriend')}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function IncomingRequestActions({ userId }: { userId: string }) {
  const t = useTranslations('product:social')
  const [acceptState, acceptAction, acceptPending] = useActionState(acceptFriendAction, initial)
  const [declineState, declineAction, declinePending] = useActionState(
    declineFriendAction,
    initial,
  )
  const error = acceptState.error || declineState.error
  return (
    <div className="sf-social-people-actions">
      <form action={acceptAction} className="sf-social-people-action">
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          className="sf-social-people-btn sf-social-people-btn-primary"
          disabled={acceptPending || declinePending}
        >
          {acceptPending ? t('acceptingFriend') : t('acceptFriend')}
        </button>
      </form>
      <form action={declineAction} className="sf-social-people-action">
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          className="sf-social-people-btn"
          disabled={acceptPending || declinePending}
        >
          {declinePending ? t('decliningFriend') : t('declineFriend')}
        </button>
      </form>
      {error ? (
        <p className="sf-social-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
