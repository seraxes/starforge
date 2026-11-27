'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { withLocalePrefix } from '@/core/i18n/path'
import type { AppLocale } from '@/core/i18n'
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
}

const initialState: MarketplaceMemberActionState = {}

export function ListingForm({ locale, mode, categories, photoCap, initial }: Props) {
  const router = useRouter()
  const action = mode === 'create' ? createMarketplaceListingAction : updateMarketplaceListingAction
  const [state, formAction, pending] = useActionState(action, initialState)
  const [condition, setCondition] = useState(initial.condition || 'used')
  const [categoryId, setCategoryId] = useState(initial.categoryId || '')
  const [free, setFree] = useState(initial.priceMinor == null)
  const [priceMinor, setPriceMinor] = useState(
    initial.priceMinor == null ? '' : String(initial.priceMinor),
  )

  useNotifySavedOnOk(state)

  useEffect(() => {
    if (state.ok && state.id) {
      router.push(withLocalePrefix(`/marketplace/${state.id}`, locale as AppLocale))
      router.refresh()
    }
  }, [state.ok, state.id, locale, router])

  const enabledCategories = categories.filter((c) => c.enabled || c.id === initial.categoryId)

  return (
    <form action={formAction} className="page-settings-panel sf-marketplace-listing-form">
      <div className="page-settings-panel-body">
        {mode === 'edit' && initial.id ? (
          <input type="hidden" name="id" value={initial.id} />
        ) : null}

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
            <span>Price (minor units)</span>
            <input
              name="priceMinor"
              type="number"
              min={0}
              step={1}
              value={priceMinor}
              onChange={(e) => setPriceMinor(e.target.value)}
              disabled={pending}
            />
          </label>
        ) : (
          <input type="hidden" name="priceMinor" value="" />
        )}

        <label className="settings-field">
          <span>Description</span>
          <textarea
            name="description"
            rows={6}
            maxLength={8000}
            defaultValue={initial.description}
            disabled={pending}
          />
        </label>

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

        <div className="admin-control-row">
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
        <p className="settings-hint">
          Coordinates power distance sort. The public page shows the area label only.
        </p>

        <ListingPhotosField
          initialIds={initial.mediaIds}
          photoCap={photoCap}
          disabled={pending}
        />

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
      </div>
      <div className="page-settings-actions">
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
    </form>
  )
}
