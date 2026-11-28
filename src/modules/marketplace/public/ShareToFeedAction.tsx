'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import {
  shareMarketplaceListingToFeedAction,
  type MarketplaceMemberActionState,
} from '../actions'

type Props = {
  listingId: string
  canShare: boolean
}

const initial: MarketplaceMemberActionState = {}

export function ShareToFeedAction({ listingId, canShare }: Props) {
  const router = useRouter()
  const [state, action, busy] = useActionState(
    shareMarketplaceListingToFeedAction,
    initial,
  )

  useNotifySavedOnOk(state)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  if (!canShare) return null

  return (
    <div className="sf-marketplace-share-action">
      <form action={action}>
        <input type="hidden" name="id" value={listingId} />
        <button
          type="submit"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
        >
          {busy ? 'Sharing…' : 'Share to feed'}
        </button>
      </form>
      {state.error ? (
        <span className="admin-inline-error" role="alert">
          {state.error}
        </span>
      ) : null}
      {state.ok && state.message ? (
        <span className="admin-inline-ok" role="status">
          {state.message}
        </span>
      ) : null}
    </div>
  )
}
