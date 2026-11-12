'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { PaymentMethodKind } from '@/core/payments'

import { savePaymentsSettingsAction, type PaymentsActionState } from '../actions'
import type { PaymentsSettings } from '../types'

const ALL_METHODS: { value: PaymentMethodKind; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'pay_at_entrance', label: 'Pay at entrance' },
  { value: 'cash', label: 'Cash' },
  { value: 'barion', label: 'Barion' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
]

const initial: PaymentsActionState = {}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      className="gantry-toolbar-btn gantry-toolbar-btn-save"
      disabled={pending}
    >
      {pending ? 'Saving…' : 'Save settings'}
    </button>
  )
}

export function PaymentsSettingsForm({ settings }: { settings: PaymentsSettings }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(savePaymentsSettingsAction, initial)
  const [methods, setMethods] = React.useState<string[]>(settings.enabledMethods)

  useNotifySavedOnOk(state)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  function toggle(method: string) {
    setMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method],
    )
  }

  return (
    <form action={action} className="sf-payments-settings">
      <input type="hidden" name="enabledMethods" value={methods.join(',')} />

      <div className="page-settings-actions">
        <SaveButton pending={pending} />
      </div>

      <div className="admin-settings-mosaic">
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Commerce defaults</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field">
              <span>Currency (ISO)</span>
              <input
                type="text"
                name="currency"
                defaultValue={settings.currency}
                required
                disabled={pending}
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>Price entry mode</span>
              <select
                name="amountEntryMode"
                defaultValue={settings.amountEntryMode}
                disabled={pending}
              >
                <option value="gross">Gross (incl. VAT)</option>
                <option value="net">Net (excl. VAT)</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Default VAT rate (bps, 2700 = 27%)</span>
              <input
                name="defaultVatRateBps"
                type="number"
                defaultValue={settings.defaultVatRateBps}
                min={0}
                max={10000}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Tax country</span>
              <input
                type="text"
                name="taxCountry"
                defaultValue={settings.taxCountry}
                disabled={pending}
                autoComplete="country"
              />
            </label>
            <label className="settings-field">
              <span>Invoice series prefix</span>
              <input
                type="text"
                name="invoiceSeriesPrefix"
                defaultValue={settings.invoiceSeriesPrefix}
                disabled={pending}
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>Checkout TTL (minutes)</span>
              <input
                name="checkoutTtlMinutes"
                type="number"
                min={5}
                defaultValue={settings.checkoutTtlMinutes}
                disabled={pending}
              />
            </label>
            <p className="settings-hint">Enabled methods (site MoR)</p>
            {ALL_METHODS.map((m) => (
              <label key={m.value} className="settings-field settings-flag">
                <input
                  type="checkbox"
                  checked={methods.includes(m.value)}
                  onChange={() => toggle(m.value)}
                  disabled={pending}
                />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Site seller (platform MoR)</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field">
              <span>Seller name</span>
              <input
                type="text"
                name="sellerName"
                defaultValue={settings.sellerName}
                disabled={pending}
                autoComplete="organization"
              />
            </label>
            <label className="settings-field">
              <span>Seller address</span>
              <textarea
                name="sellerAddress"
                defaultValue={settings.sellerAddress}
                rows={2}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Seller VAT ID</span>
              <input
                type="text"
                name="sellerVatId"
                defaultValue={settings.sellerVatId}
                disabled={pending}
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>Bank account name</span>
              <input
                type="text"
                name="bankAccountName"
                defaultValue={settings.bankAccountName}
                disabled={pending}
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>Bank name</span>
              <input
                type="text"
                name="bankName"
                defaultValue={settings.bankName}
                disabled={pending}
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>IBAN</span>
              <input
                type="text"
                name="bankIban"
                defaultValue={settings.bankIban}
                disabled={pending}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="settings-field">
              <span>Pay at entrance instructions</span>
              <textarea
                name="entranceInstructions"
                defaultValue={settings.entranceInstructions}
                rows={2}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Cash instructions</span>
              <textarea
                name="cashInstructions"
                defaultValue={settings.cashInstructions}
                rows={2}
                disabled={pending}
              />
            </label>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Gateway secrets &amp; email</h3>
          </header>
          <div className="page-settings-panel-body">
            <p className="settings-hint">
              Platform gateway keys live in Environment — not here. Receipt templates are owned by
              Email Manager.
            </p>
            <div className="page-settings-actions">
              <Link
                href="/admin/environment"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              >
                Environment
              </Link>
              <Link href="/admin/email" className="gantry-toolbar-btn gantry-toolbar-btn-muted">
                Email Manager
              </Link>
            </div>
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
