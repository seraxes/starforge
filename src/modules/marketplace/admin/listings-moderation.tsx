'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  hideMarketplaceListingAction,
  removeMarketplaceListingAction,
  restoreMarketplaceListingAction,
  type MarketplaceAdminActionState,
} from '../actions'
import type { MarketplaceListingRecord } from '../types'

type Row = Omit<MarketplaceListingRecord, 'createdAt' | 'updatedAt' | 'expiresAt'> & {
  createdAt: string
  updatedAt: string
  expiresAt: string | null
}

type Props = {
  listings: Row[]
  loadError?: string
}

function listingEditHref(id: string): string {
  return `/admin/marketplace/listings/${encodeURIComponent(id)}`
}

const initial: MarketplaceAdminActionState = {}

function formatPrice(priceMinor: number | null): string {
  if (priceMinor == null) return 'Free'
  return String(priceMinor)
}

function ModerationActions({
  listing,
}: {
  listing: Row
}) {
  const router = useRouter()
  const [hideState, hideAction, hidePending] = useActionState(
    hideMarketplaceListingAction,
    initial,
  )
  const [removeState, removeAction, removePending] = useActionState(
    removeMarketplaceListingAction,
    initial,
  )
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreMarketplaceListingAction,
    initial,
  )

  useNotifySavedOnOk(hideState)
  useNotifySavedOnOk(removeState)
  useNotifySavedOnOk(restoreState)

  useEffect(() => {
    if (hideState.ok || removeState.ok || restoreState.ok) router.refresh()
  }, [hideState.ok, removeState.ok, restoreState.ok, router])

  const busy = hidePending || removePending || restorePending
  const feedback = hideState.error || removeState.error || restoreState.error
  const okMessage =
    (hideState.ok && hideState.message) ||
    (removeState.ok && removeState.message) ||
    (restoreState.ok && restoreState.message) ||
    null

  return (
    <div className="admin-action-row sf-events-list-row-actions">
      <Link
        href={listingEditHref(listing.id)}
        className="gantry-toolbar-btn gantry-toolbar-btn-muted"
      >
        Edit
      </Link>
      {listing.status !== 'hidden' && listing.status !== 'removed' ? (
        <form action={hideAction}>
          <input type="hidden" name="id" value={listing.id} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={busy}
          >
            {hidePending ? 'Hiding…' : 'Hide'}
          </button>
        </form>
      ) : null}
      {listing.status !== 'removed' ? (
        <form action={removeAction}>
          <input type="hidden" name="id" value={listing.id} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-muted"
            disabled={busy}
          >
            {removePending ? 'Removing…' : 'Remove'}
          </button>
        </form>
      ) : null}
      {listing.status === 'hidden' || listing.status === 'removed' ? (
        <form action={restoreAction}>
          <input type="hidden" name="id" value={listing.id} />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={busy}
          >
            {restorePending ? 'Restoring…' : 'Restore'}
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

export function ListingsModeration({ listings, loadError }: Props) {
  return (
    <div className="sf-marketplace-listings-moderation">
      {loadError ? (
        <p className="admin-inline-error" role="alert">
          {loadError}
        </p>
      ) : null}
      {listings.length === 0 && !loadError ? (
        <p className="layout-muted">
          No listings yet. Staff can edit, hide, remove, and restore once rows exist.
        </p>
      ) : null}
      {listings.length > 0 ? (
        <div className="page-settings-panel">
          <div className="page-settings-panel-body">
            <div className="outlines-table-wrap sf-events-list-table-wrap">
              <table className="outlines-table sf-events-list-table">
                <thead>
                  <tr>
                    <th scope="col">Title</th>
                    <th scope="col">Seller</th>
                    <th scope="col">Status</th>
                    <th scope="col">Price</th>
                    <th scope="col">Expires</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => (
                    <tr key={listing.id}>
                      <td>
                        <Link
                          href={listingEditHref(listing.id)}
                          className="sf-events-list-title"
                        >
                          {listing.title}
                        </Link>
                        <div className="settings-hint">{listing.condition}</div>
                      </td>
                      <td>
                        <code>{listing.sellerUserId}</code>
                      </td>
                      <td>{listing.status}</td>
                      <td>{formatPrice(listing.priceMinor)}</td>
                      <td>
                        {listing.expiresAt
                          ? new Date(listing.expiresAt).toLocaleString()
                          : '—'}
                      </td>
                      <td>
                        <ModerationActions listing={listing} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
