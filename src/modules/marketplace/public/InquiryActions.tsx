'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  askMarketplaceAvailableAction,
  openMarketplaceOfferAction,
  postMarketplaceInquiryMessageAction,
  respondMarketplaceOfferAction,
  type MarketplaceMemberActionState,
} from '../actions'
import type {
  MarketplaceInquiryRecord,
  MarketplaceMessageRecord,
  MarketplaceOfferRecord,
} from '../offer-rules'

const initial: MarketplaceMemberActionState = {}

function MessageList({
  messages,
  viewerUserId,
}: {
  messages: MarketplaceMessageRecord[]
  viewerUserId: string
}) {
  if (messages.length === 0) {
    return <p className="settings-hint">No messages yet.</p>
  }
  return (
    <ul className="sf-marketplace-inquiry-messages">
      {messages.map((msg) => {
        const mine = msg.authorUserId === viewerUserId
        return (
          <li key={msg.id} className="sf-marketplace-inquiry-message">
            <span className="settings-hint">
              {mine ? 'You' : 'Them'}
              {msg.kind === 'availability' ? ' · Ask if available' : ''}
            </span>
            <p style={{ whiteSpace: 'pre-wrap', margin: '0.25rem 0 0' }}>{msg.body}</p>
          </li>
        )
      })}
    </ul>
  )
}

function InlineState({ state }: { state: MarketplaceMemberActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

/** Buyer tools: ask available, offer, message on their inquiry. */
export function BuyerInquiryPanel({
  listingId,
  signedIn,
  offersEnabled,
  thread,
  viewerUserId,
}: {
  listingId: string
  signedIn: boolean
  offersEnabled: boolean
  thread: {
    inquiry: MarketplaceInquiryRecord
    messages: MarketplaceMessageRecord[]
    openOffer: MarketplaceOfferRecord | null
  } | null
  viewerUserId: string
}) {
  const router = useRouter()
  const [askState, askAction, askPending] = useActionState(
    askMarketplaceAvailableAction,
    initial,
  )
  const [offerState, offerAction, offerPending] = useActionState(
    openMarketplaceOfferAction,
    initial,
  )
  const [msgState, msgAction, msgPending] = useActionState(
    postMarketplaceInquiryMessageAction,
    initial,
  )
  const [amountMinor, setAmountMinor] = useState('')
  const [body, setBody] = useState('')

  useEffect(() => {
    if (askState.ok || offerState.ok || msgState.ok) router.refresh()
  }, [askState.ok, offerState.ok, msgState.ok, router])

  if (!signedIn) {
    return (
      <p className="settings-hint">Sign in to ask if available or make an offer.</p>
    )
  }

  const busy = askPending || offerPending || msgPending
  const hasOpenOffer = Boolean(thread?.openOffer)

  return (
    <div className="sf-marketplace-buyer-inquiry">
      <form action={askAction} className="admin-control-row" style={{ marginBottom: '0.75rem' }}>
        <input type="hidden" name="id" value={listingId} />
        <button
          type="submit"
          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
          disabled={busy}
        >
          {askPending ? 'Asking…' : 'Ask if available'}
        </button>
      </form>
      <InlineState state={askState} />

      {offersEnabled ? (
        <form action={offerAction} style={{ marginBottom: '0.75rem' }}>
          <input type="hidden" name="id" value={listingId} />
          <div className="admin-control-row">
            <label className="settings-field" style={{ margin: 0, flex: 1 }}>
              <span>Your offer (minor units)</span>
              <input
                type="number"
                name="amountMinor"
                min={0}
                step={1}
                value={amountMinor}
                disabled={busy || hasOpenOffer}
                onChange={(event) => setAmountMinor(event.target.value)}
                required
              />
            </label>
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={busy || hasOpenOffer}
            >
              {offerPending ? 'Sending…' : hasOpenOffer ? 'Offer open' : 'Make offer'}
            </button>
          </div>
          {hasOpenOffer && thread?.openOffer ? (
            <p className="settings-hint">
              Open offer: {thread.openOffer.amountMinor} minor units. Wait for the seller.
            </p>
          ) : null}
          <InlineState state={offerState} />
        </form>
      ) : (
        <p className="settings-hint">Offers are turned off for this site.</p>
      )}

      {thread ? (
        <>
          <MessageList messages={thread.messages} viewerUserId={viewerUserId} />
          <form action={msgAction} style={{ marginTop: '0.75rem' }}>
            <input type="hidden" name="inquiryId" value={thread.inquiry.id} />
            <input type="hidden" name="listingId" value={listingId} />
            <label className="settings-field">
              <span>Message</span>
              <textarea
                name="body"
                rows={3}
                value={body}
                disabled={busy}
                onChange={(event) => setBody(event.target.value)}
                required
              />
            </label>
            <div className="page-settings-actions">
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
              >
                {msgPending ? 'Sending…' : 'Send message'}
              </button>
            </div>
            <InlineState state={msgState} />
          </form>
        </>
      ) : null}
    </div>
  )
}

/** Seller tools: view threads, accept / decline open offers. */
export function SellerInquiryPanel({
  listingId,
  threads,
  viewerUserId,
}: {
  listingId: string
  threads: Array<{
    inquiry: MarketplaceInquiryRecord
    messages: MarketplaceMessageRecord[]
    openOffer: MarketplaceOfferRecord | null
  }>
  viewerUserId: string
}) {
  const router = useRouter()
  const [respondState, respondAction, respondPending] = useActionState(
    respondMarketplaceOfferAction,
    initial,
  )
  const [msgState, msgAction, msgPending] = useActionState(
    postMarketplaceInquiryMessageAction,
    initial,
  )
  const [replyByInquiry, setReplyByInquiry] = useState<Record<string, string>>({})

  useEffect(() => {
    if (respondState.ok || msgState.ok) router.refresh()
  }, [respondState.ok, msgState.ok, router])

  if (threads.length === 0) {
    return <p className="settings-hint">No inquiries yet.</p>
  }

  const busy = respondPending || msgPending

  return (
    <div className="sf-marketplace-seller-inquiries">
      <InlineState state={respondState} />
      {threads.map((thread) => (
        <div
          key={thread.inquiry.id}
          className="sf-marketplace-seller-inquiry"
          style={{ marginBottom: '1.25rem' }}
        >
          <p className="settings-hint">
            Buyer {thread.inquiry.buyerUserId.slice(0, 8)}…
          </p>
          <MessageList messages={thread.messages} viewerUserId={viewerUserId} />

          {thread.openOffer ? (
            <form action={respondAction} className="admin-control-row" style={{ marginTop: '0.5rem' }}>
              <input type="hidden" name="inquiryId" value={thread.inquiry.id} />
              <input type="hidden" name="listingId" value={listingId} />
              <span className="settings-hint">
                Open offer: {thread.openOffer.amountMinor} minor units
              </span>
              <button
                type="submit"
                name="response"
                value="accept"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={busy}
              >
                Accept
              </button>
              <button
                type="submit"
                name="response"
                value="decline"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
              >
                Decline
              </button>
            </form>
          ) : null}

          <form action={msgAction} style={{ marginTop: '0.75rem' }}>
            <input type="hidden" name="inquiryId" value={thread.inquiry.id} />
            <input type="hidden" name="listingId" value={listingId} />
            <label className="settings-field">
              <span>Reply</span>
              <textarea
                name="body"
                rows={2}
                value={replyByInquiry[thread.inquiry.id] || ''}
                disabled={busy}
                onChange={(event) =>
                  setReplyByInquiry((prev) => ({
                    ...prev,
                    [thread.inquiry.id]: event.target.value,
                  }))
                }
                required
              />
            </label>
            <div className="page-settings-actions">
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
              >
                {msgPending ? 'Sending…' : 'Send reply'}
              </button>
            </div>
          </form>
        </div>
      ))}
      <InlineState state={msgState} />
    </div>
  )
}
