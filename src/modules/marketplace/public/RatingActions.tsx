'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import {
  submitMarketplaceRatingAction,
  type MarketplaceMemberActionState,
} from '../actions'
import type { RatingDirection } from '../rating-rules'

const initial: MarketplaceMemberActionState = {}

/** Submit a rating after a sold handoff or accepted offer. */
export function RatingSubmitForm({
  listingId,
  toUserId,
  direction,
  signedIn,
}: {
  listingId: string
  toUserId: string
  direction: RatingDirection
  signedIn: boolean
}) {
  const t = useTranslations('product:marketplace')
  const router = useRouter()
  const [score, setScore] = useState('5')
  const [note, setNote] = useState('')
  const [state, formAction, pending] = useActionState(
    submitMarketplaceRatingAction,
    initial,
  )

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  if (!signedIn) return null

  const label =
    direction === 'buyer_rates_seller' ? t('rateSeller') : t('rateBuyer')

  return (
    <section className="page-settings-panel">
      <div className="page-settings-panel-head">
        <h2>{label}</h2>
      </div>
      <div className="page-settings-panel-body">
        <form action={formAction}>
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="toUserId" value={toUserId} />
          <input type="hidden" name="direction" value={direction} />
          <label className="settings-field">
            <span>{t('scoreLabel')}</span>
            <select
              name="score"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              disabled={pending}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>{t('noteOptional')}</span>
            <textarea
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              disabled={pending}
            />
          </label>
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? t('submitting') : t('submitRating')}
            </button>
          </div>
          {state.error ? (
            <p className="admin-inline-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok && state.message ? (
            <p className="admin-inline-ok" role="status">
              {state.message}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  )
}
