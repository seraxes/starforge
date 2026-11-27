'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  saveMarketplaceSettingsAction,
  seedMarketplaceEmailStartersAction,
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
  const [seedState, seedAction, seedPending] = useActionState(
    seedMarketplaceEmailStartersAction,
    initial,
  )
  useNotifySavedOnOk(state)
  useNotifySavedOnOk(seedState)
  useEffect(() => {
    if (state.ok || seedState.ok) router.refresh()
  }, [state.ok, seedState.ok, router])

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

  const busy = pending || seedPending

  return (
    <div className="sf-marketplace-settings">
      <form action={formAction}>
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
                  disabled={busy}
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
                  disabled={busy}
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
                  Max ordered Media library ids on one listing. Public Sell uses
                  MemberMediaPicker; admin edit uses MediaPicker.
                </span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="offersEnabled"
                  value="1"
                  checked={offersEnabled}
                  disabled={busy}
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
                  disabled={busy}
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
                  disabled={busy}
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
                  When on, new listings stay draft until the listing fee is paid. Fee amount is
                  quoted server-side from this field — never from the client. Coupons and gateways
                  stay in <Link href="/admin/payments">Payments</Link>.
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

      <section className="page-settings-panel" style={{ marginTop: '1.25rem' }}>
        <header className="page-settings-panel-head">
          <h3>Inquiry emails</h3>
        </header>
        <div className="page-settings-panel-body">
          <p className="settings-hint">
            Seeds Email Manager templates + rules for{' '}
            <code>product:marketplace/inquiry.created</code>,{' '}
            <code>product:marketplace/offer.received</code>, and{' '}
            <code>product:marketplace/offer.accepted</code>. Edit copy under{' '}
            <Link href="/admin/email">Email Manager</Link>.
          </p>
          <div className="page-settings-actions">
            <form action={seedAction}>
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
              >
                {seedPending ? 'Seeding…' : 'Seed inquiry emails'}
              </button>
            </form>
            <Link className="gantry-toolbar-btn gantry-toolbar-btn-muted" href="/admin/email">
              Open Email Manager
            </Link>
          </div>
          {seedState.error ? (
            <p className="admin-inline-error" role="alert">
              {seedState.error}
            </p>
          ) : null}
          {seedState.ok && seedState.message ? (
            <p className="admin-inline-ok" role="status">
              {seedState.message}
            </p>
          ) : null}
        </div>
      </section>
    </div>
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
