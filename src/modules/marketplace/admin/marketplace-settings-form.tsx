'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  saveMarketplaceSettingsAction,
  type MarketplaceAdminActionState,
} from '../actions'
import {
  MARKETPLACE_EXPIRY_DAY_OPTIONS,
  MARKETPLACE_PHOTO_CAP_OPTIONS,
  type MarketplaceModuleSettings,
} from '../types'

type Props = {
  settings: MarketplaceModuleSettings
}

const initial: MarketplaceAdminActionState = {}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
      {pending ? 'Saving…' : 'Save settings'}
    </button>
  )
}

function settingsRemountKey(settings: MarketplaceModuleSettings): string {
  return [
    settings.expiryDays,
    settings.photoCap,
    settings.offersEnabled ? 1 : 0,
    settings.listingFeeEnabled ? 1 : 0,
    settings.listingFeeMinor,
  ].join(':')
}

function MarketplaceSettingsFormFields({ settings }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(saveMarketplaceSettingsAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state.ok, router])

  // Controlled so a successful action form-reset cannot snap back to the
  // mount-time default. Parent remounts this tree when saved props change.
  const [expiryDays, setExpiryDays] = useState(settings.expiryDays)
  const [photoCap, setPhotoCap] = useState(settings.photoCap)
  const [offersEnabled, setOffersEnabled] = useState(settings.offersEnabled)
  const [listingFeeEnabled, setListingFeeEnabled] = useState(settings.listingFeeEnabled)
  const [listingFeeMinor, setListingFeeMinor] = useState(settings.listingFeeMinor)

  const expiryOptions = Array.from(
    new Set<number>([...MARKETPLACE_EXPIRY_DAY_OPTIONS, expiryDays]),
  ).sort((a, b) => a - b)
  const photoOptions = Array.from(
    new Set<number>([...MARKETPLACE_PHOTO_CAP_OPTIONS, photoCap]),
  ).sort((a, b) => a - b)

  return (
    <form action={formAction} className="sf-marketplace-settings">
      <div className="page-settings-actions" style={{ marginBottom: '1rem' }}>
        <SaveButton pending={pending} />
      </div>

      <div className="admin-settings-mosaic">
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Listings</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field">
              <span>Expiry days</span>
              <select
                name="expiryDays"
                value={String(expiryDays)}
                disabled={pending}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (Number.isFinite(next) && next >= 1) setExpiryDays(Math.trunc(next))
                }}
              >
                {expiryOptions.map((days) => (
                  <option key={days} value={days}>
                    {days} days
                  </option>
                ))}
              </select>
              <span className="settings-hint">
                Renew and first publish set <code>expiresAt</code> to now + this many days.
              </span>
            </label>
            <label className="settings-field">
              <span>Photo cap</span>
              <select
                name="photoCap"
                value={String(photoCap)}
                disabled={pending}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (Number.isFinite(next) && next >= 1) setPhotoCap(Math.trunc(next))
                }}
              >
                {photoOptions.map((cap) => (
                  <option key={cap} value={cap}>
                    {cap}
                  </option>
                ))}
              </select>
              <span className="settings-hint">
                Max ordered Media library ids on one listing. Photos use MediaPicker later.
              </span>
            </label>
            <label className="settings-field settings-flag">
              <input
                type="checkbox"
                name="offersEnabled"
                value="1"
                checked={offersEnabled}
                disabled={pending}
                onChange={(event) => setOffersEnabled(event.target.checked)}
              />
              <span>Offers enabled</span>
            </label>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Listing fee</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field settings-flag">
              <input
                type="checkbox"
                name="listingFeeEnabled"
                value="1"
                checked={listingFeeEnabled}
                disabled={pending}
                onChange={(event) => setListingFeeEnabled(event.target.checked)}
              />
              <span>Require listing fee to publish</span>
            </label>
            <label className="settings-field">
              <span>Listing fee (minor units)</span>
              <input
                type="number"
                name="listingFeeMinor"
                min={0}
                step={1}
                value={listingFeeMinor}
                disabled={pending}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  if (!Number.isFinite(next) || next < 0) {
                    setListingFeeMinor(0)
                    return
                  }
                  setListingFeeMinor(Math.trunc(next))
                }}
              />
              <span className="settings-hint">
                Saved here only. Payments checkout for the fee lands in a later slice. Coupons and
                gateways stay in <Link href="/admin/payments">Payments</Link>.
              </span>
            </label>
          </div>
        </section>
      </div>

      <div className="page-settings-actions">
        <SaveButton pending={pending} />
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
  )
}

export function MarketplaceSettingsForm({ settings }: Props) {
  return (
    <MarketplaceSettingsFormFields
      key={settingsRemountKey(settings)}
      settings={settings}
    />
  )
}
