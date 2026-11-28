'use client'

import React, { useActionState } from 'react'
import { useTranslations } from 'next-intl'

import {
  followUserAction,
  unfollowUserAction,
  type SocialFollowActionState,
} from '../actions'

const initial: SocialFollowActionState = {}

export function FollowButton({ userId }: { userId: string }) {
  const t = useTranslations('product:social')
  const [state, action, pending] = useActionState(followUserAction, initial)
  return (
    <form action={action} className="sf-social-follow-action">
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="sf-social-follow-btn" disabled={pending}>
        {pending ? t('followingPending') : t('follow')}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}

export function UnfollowButton({ userId }: { userId: string }) {
  const t = useTranslations('product:social')
  const [state, action, pending] = useActionState(unfollowUserAction, initial)
  return (
    <form action={action} className="sf-social-follow-action">
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="sf-social-follow-btn" disabled={pending}>
        {pending ? t('removing') : t('unfollow')}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
