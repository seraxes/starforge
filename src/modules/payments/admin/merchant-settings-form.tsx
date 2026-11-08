'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import { saveMerchantProfileAction, type PaymentsActionState } from '../actions'
import type { CredentialPublic, MerchantRecord } from '../merchant-store'

const initial: PaymentsActionState = {}

export function MerchantSettingsForm({
  merchant,
  credentials,
}: {
  merchant: MerchantRecord
  credentials: CredentialPublic[]
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(saveMerchantProfileAction, initial)

  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  const barion = credentials.find((c) => c.kind === 'barion')
  const billing = credentials.find(
    (c) => c.kind === 'billingo' || c.kind === 'szamlazz',
  )

  return (
    <form action={action} className="sf-payments-merchant">
      <div className="admin-settings-mosaic">
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Merchant profile</h3>
          </header>
          <div className="page-settings-panel-body">
            <p className="settings-hint">
              Own gateway keys settle to your bank. Flat premium subscription unlocks collect — no
              platform % fee for now. Invoices go through Billingo / Számlázz.hu (your account).
            </p>
            <label className="settings-field">
              <span>Display name</span>
              <input
                type="text"
                name="displayName"
                defaultValue={merchant.displayName}
                disabled={pending}
                autoComplete="organization"
              />
            </label>
            <label className="settings-field">
              <span>Status</span>
              <select name="status" defaultValue={merchant.status} disabled={pending}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Seller legal name</span>
              <input
                type="text"
                name="sellerName"
                defaultValue={merchant.sellerName}
                disabled={pending}
                autoComplete="organization"
              />
            </label>
            <label className="settings-field">
              <span>Seller address</span>
              <textarea
                name="sellerAddress"
                defaultValue={merchant.sellerAddress}
                rows={2}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Seller VAT ID</span>
              <input
                type="text"
                name="sellerVatId"
                defaultValue={merchant.sellerVatId}
                disabled={pending}
                autoComplete="off"
              />
            </label>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Offline bank / entrance</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field">
              <span>Bank account name</span>
              <input
                type="text"
                name="bankAccountName"
                defaultValue={merchant.bankAccountName}
                disabled={pending}
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>Bank name</span>
              <input
                type="text"
                name="bankName"
                defaultValue={merchant.bankName}
                disabled={pending}
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>IBAN</span>
              <input
                type="text"
                name="bankIban"
                defaultValue={merchant.bankIban}
                disabled={pending}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="settings-field">
              <span>Pay at entrance instructions</span>
              <textarea
                name="entranceInstructions"
                defaultValue={merchant.entranceInstructions}
                rows={2}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Cash instructions</span>
              <textarea
                name="cashInstructions"
                defaultValue={merchant.cashInstructions}
                rows={2}
                disabled={pending}
              />
            </label>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Barion (own POS)</h3>
          </header>
          <div className="page-settings-panel-body">
            <p className="settings-hint">
              {barion?.hasSecret
                ? `Saved key ends with ${barion.masked}`
                : 'No Barion key saved yet.'}
            </p>
            <label className="settings-field">
              <span>POS key (leave blank to keep)</span>
              <input
                name="barionPosKey"
                type="password"
                autoComplete="off"
                disabled={pending}
                placeholder="••••"
              />
            </label>
            <label className="settings-field">
              <span>Payee email</span>
              <input
                type="email"
                name="barionPayeeEmail"
                defaultValue={String(barion?.meta?.payeeEmail || '')}
                disabled={pending}
                autoComplete="email"
              />
            </label>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Digital invoices</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field">
              <span>Billing provider</span>
              <select
                name="billingProvider"
                defaultValue={merchant.billingProvider}
                disabled={pending}
              >
                <option value="noop">None (dev)</option>
                <option value="billingo">Billingo</option>
                <option value="szamlazz">Számlázz.hu</option>
              </select>
            </label>
            <p className="settings-hint">
              {billing?.hasSecret
                ? `Saved API key ends with ${billing.masked}`
                : 'No billing API key saved yet.'}
            </p>
            <label className="settings-field">
              <span>API / agent key (leave blank to keep)</span>
              <input
                name="billingApiKey"
                type="password"
                autoComplete="off"
                disabled={pending}
                placeholder="••••"
              />
            </label>
            <label className="settings-field">
              <span>Billingo block id (optional)</span>
              <input
                type="text"
                name="billingBlockId"
                defaultValue={String(billing?.meta?.blockId || '')}
                disabled={pending}
                autoComplete="off"
              />
            </label>

            <div className="page-settings-actions">
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={pending}
              >
                {pending ? 'Saving…' : 'Save merchant'}
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
          </div>
        </section>
      </div>
    </form>
  )
}
