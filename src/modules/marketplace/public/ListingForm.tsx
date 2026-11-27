'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { withLocalePrefix } from '@/core/i18n/path'
import type { AppLocale } from '@/core/i18n'
import { majorToMinor, minorToMajor } from '@/core/payments/money'
import { LISTING_CONDITIONS } from '../listing-rules'
import {
  createMarketplaceListingAction,
  updateMarketplaceListingAction,
  type MarketplaceMemberActionState,
} from '../actions'
import { ListingPhotosField } from './ListingPhotosField'

export type ListingFormCategory = {
  id: string
  title: string
  enabled: boolean
}

export type ListingFormValues = {
  id?: string
  title: string
  description: string
  condition: string
  priceMinor: number | null
  categoryId: string
  areaLabel: string
  latitude: number | null
  longitude: number | null
  mediaIds: string[]
}

type Props = {
  locale: AppLocale | string
  mode: 'create' | 'edit'
  categories: ListingFormCategory[]
  photoCap: number
  initial: ListingFormValues
  currency?: string
  /**
   * Where to go after a successful save (no checkout).
   * Admin editors pass an `/admin/…` path so staff stay in admin.
   * Omit on public create/edit to return to the public listing detail.
   */
  successHref?: string
  /** Optional cancel link (admin Cancel → listings list). */
  cancelHref?: string
  /**
   * Photo bind UI. Public Sell / edit use member upload + library popup.
   * Admin staff editors pass `library` for the full MediaPicker modal.
   */
  photosPicker?: 'member' | 'library'
}

const initialState: MarketplaceMemberActionState = {}

export function ListingForm({
  locale,
  mode,
  categories,
  photoCap,
  initial,
  currency = 'HUF',
  successHref,
  cancelHref,
  photosPicker = 'member',
}: Props) {
  const router = useRouter()
  const action = mode === 'create' ? createMarketplaceListingAction : updateMarketplaceListingAction
  const [state, formAction, pending] = useActionState(action, initialState)
  const [condition, setCondition] = useState(initial.condition || 'used')
  const [categoryId, setCategoryId] = useState(initial.categoryId || '')
  const [free, setFree] = useState(initial.priceMinor == null)
  const [priceMajor, setPriceMajor] = useState(
    initial.priceMinor == null ? '' : String(minorToMajor(initial.priceMinor, currency)),
  )

  useNotifySavedOnOk(state)

  useEffect(() => {
    if (!state.ok) return
    if (state.checkoutPath) {
      router.push(state.checkoutPath)
      router.refresh()
      return
    }
    if (state.id) {
      const next =
        successHref ||
        withLocalePrefix(`/marketplace/${state.id}`, locale as AppLocale)
      router.push(next)
      router.refresh()
    }
  }, [state.ok, state.id, state.checkoutPath, locale, router, successHref])

  const enabledCategories = categories.filter((c) => c.enabled || c.id === initial.categoryId)
  const priceMinorValue =
    free || priceMajor.trim() === ''
      ? ''
      : (() => {
          const major = Number(priceMajor)
          if (!Number.isFinite(major)) return ''
          const minor = majorToMinor(major, currency)
          return minor == null ? '' : String(minor)
        })()

  return (
    <form action={formAction} className="sf-marketplace-listing-form">
      {mode === 'edit' && initial.id ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="sf-marketplace-listing-form-main">
        <label className="settings-field">
          <span>Title</span>
          <input
            name="title"
            type="text"
            required
            maxLength={200}
            defaultValue={initial.title}
            disabled={pending}
          />
        </label>

        <div className="sf-marketplace-listing-form-row">
          <label className="settings-field">
            <span>Category</span>
            <select
              name="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              disabled={pending}
            >
              <option value="">Select a category</option>
              {enabledCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {!c.enabled ? ' (disabled)' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="settings-field">
            <span>Condition</span>
            <select
              name="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              disabled={pending}
            >
              {LISTING_CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c === 'new' ? 'New' : c === 'refurbished' ? 'Refurbished' : 'Used'}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="sf-marketplace-listing-form-row sf-marketplace-listing-price-row">
          <label className="settings-field settings-flag">
            <span>
              <input
                type="checkbox"
                name="free"
                value="1"
                checked={free}
                onChange={(e) => setFree(e.target.checked)}
                disabled={pending}
              />{' '}
              Free
            </span>
          </label>

          {!free ? (
            <label className="settings-field">
              <span>Price</span>
              <input
                type="number"
                min={0}
                step="any"
                value={priceMajor}
                onChange={(e) => setPriceMajor(e.target.value)}
                disabled={pending}
                inputMode="decimal"
              />
              <input type="hidden" name="priceMinor" value={priceMinorValue} />
            </label>
          ) : (
            <input type="hidden" name="priceMinor" value="" />
          )}
        </div>

        <label className="settings-field">
          <span>Description</span>
          <textarea
            name="description"
            rows={5}
            maxLength={8000}
            defaultValue={initial.description}
            disabled={pending}
          />
        </label>

        <ListingPhotosField
          initialIds={initial.mediaIds}
          photoCap={photoCap}
          disabled={pending}
          picker={photosPicker}
        />

        <label className="settings-field">
          <span>Area</span>
          <input
            name="areaLabel"
            type="text"
            maxLength={200}
            defaultValue={initial.areaLabel}
            placeholder="City or neighborhood (not a street address)"
            disabled={pending}
          />
        </label>

        <details className="sf-marketplace-distance-disclosure">
          <summary>Distance (optional)</summary>
          <p className="settings-hint">
            Coordinates power distance sort. The public page shows the area label only.
          </p>
          <div className="sf-marketplace-listing-form-row">
            <label className="settings-field">
              <span>Latitude</span>
              <input
                name="latitude"
                type="number"
                step="any"
                defaultValue={initial.latitude ?? ''}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Longitude</span>
              <input
                name="longitude"
                type="number"
                step="any"
                defaultValue={initial.longitude ?? ''}
                disabled={pending}
              />
            </label>
          </div>
        </details>

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

        <div className="sf-marketplace-listing-form-actions page-settings-actions">
          {cancelHref ? (
            <Link href={cancelHref} className="gantry-toolbar-btn gantry-toolbar-btn-muted">
              Cancel
            </Link>
          ) : null}
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={pending}
          >
            {pending
              ? mode === 'create'
                ? 'Publishing…'
                : 'Saving…'
              : mode === 'create'
                ? 'Publish listing'
                : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  )
}
