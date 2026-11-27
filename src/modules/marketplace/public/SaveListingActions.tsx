'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import {
  saveMarketplaceListingAction,
  unsaveMarketplaceListingAction,
  type MarketplaceMemberActionState,
} from '../actions'

const initial: MarketplaceMemberActionState = {}

/** Save / unsave control on the listing detail page. */
export function SaveListingActions({
  listingId,
  saved,
  signedIn,
}: {
  listingId: string
  saved: boolean
  signedIn: boolean
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    saved ? unsaveMarketplaceListingAction : saveMarketplaceListingAction,
    initial,
  )

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  if (!signedIn) return null

  return (
    <form action={formAction} className="sf-marketplace-save-actions">
      <input type="hidden" name="id" value={listingId} />
      <button
        type="submit"
        className={
          saved
            ? 'gantry-toolbar-btn gantry-toolbar-btn-save'
            : 'gantry-toolbar-btn gantry-toolbar-btn-muted'
        }
        aria-pressed={saved}
        disabled={pending}
      >
        {pending ? (saved ? 'Removing…' : 'Saving…') : saved ? 'Saved' : 'Save'}
      </button>
      {state.error ? (
        <span className="admin-inline-error" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  )
}
