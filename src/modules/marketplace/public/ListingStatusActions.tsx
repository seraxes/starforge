'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import {
  hideOwnMarketplaceListingAction,
  markMarketplaceListingPendingAction,
  markMarketplaceListingSoldAction,
  renewMarketplaceListingAction,
  type MarketplaceMemberActionState,
} from '../actions'
import type { ListingStatus } from '../listing-rules'

type Props = {
  listingId: string
  status: ListingStatus
  canManage: boolean
}

const initial: MarketplaceMemberActionState = {}

export function ListingStatusActions({ listingId, status, canManage }: Props) {
  const router = useRouter()
  const [soldTo, setSoldTo] = useState('')
  const [pendingState, pendingAction, pendingBusy] = useActionState(
    markMarketplaceListingPendingAction,
    initial,
  )
  const [soldState, soldAction, soldBusy] = useActionState(
    markMarketplaceListingSoldAction,
    initial,
  )
  const [renewState, renewAction, renewBusy] = useActionState(
    renewMarketplaceListingAction,
    initial,
  )
  const [hideState, hideAction, hideBusy] = useActionState(
    hideOwnMarketplaceListingAction,
    initial,
  )

  useNotifySavedOnOk(pendingState)
  useNotifySavedOnOk(soldState)
  useNotifySavedOnOk(renewState)
  useNotifySavedOnOk(hideState)

  useEffect(() => {
    if (pendingState.ok || soldState.ok || renewState.ok || hideState.ok) {
      router.refresh()
    }
  }, [pendingState.ok, soldState.ok, renewState.ok, hideState.ok, router])

  if (!canManage) return null

  const busy = pendingBusy || soldBusy || renewBusy || hideBusy
  const feedback =
    pendingState.error ||
    soldState.error ||
    renewState.error ||
    hideState.error ||
    null
  const okMessage =
    (pendingState.ok && pendingState.message) ||
    (soldState.ok && soldState.message) ||
    (renewState.ok && renewState.message) ||
    (hideState.ok && hideState.message) ||
    null

  return (
    <div className="sf-marketplace-status-actions">
      {status === 'active' ? (
        <form action={pendingAction}>
          <input type="hidden" name="id" value={listingId} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={busy}
          >
            {pendingBusy ? 'Marking…' : 'Mark pending'}
          </button>
        </form>
      ) : null}

      {status === 'pending' ? (
        <form action={soldAction} className="sf-marketplace-sold-form">
          <input type="hidden" name="id" value={listingId} />
          <label className="settings-field">
            <span>Sold to user id (optional)</span>
            <input
              name="soldToUserId"
              type="text"
              value={soldTo}
              onChange={(e) => setSoldTo(e.target.value)}
              disabled={busy}
            />
          </label>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={busy}
          >
            {soldBusy ? 'Marking…' : 'Mark sold'}
          </button>
        </form>
      ) : null}

      {status !== 'sold' && status !== 'removed' ? (
        <form action={renewAction}>
          <input type="hidden" name="id" value={listingId} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={busy}
          >
            {renewBusy ? 'Renewing…' : 'Renew'}
          </button>
        </form>
      ) : null}

      {status !== 'hidden' && status !== 'removed' && status !== 'sold' ? (
        <form action={hideAction}>
          <input type="hidden" name="id" value={listingId} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={busy}
          >
            {hideBusy ? 'Hiding…' : 'Hide'}
          </button>
        </form>
      ) : null}

      {feedback ? (
        <p className="admin-inline-error" role="alert">
          {feedback}
        </p>
      ) : null}
      {okMessage ? (
        <p className="admin-inline-ok" role="status">
          {okMessage}
        </p>
      ) : null}
    </div>
  )
}
