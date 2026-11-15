'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import type { PaymentMethodDescriptor } from '@/core/payments/adapter'
import {
  offlineMerchantMethodReady,
  paymentMethodCredentialsReady,
} from '@/core/payments/credential-schema'
import type { PaymentMethodKind } from '@/core/payments'

import { saveMerchantProfileAction, type PaymentsActionState } from '../actions'
import type { CredentialPublic, MerchantRecord } from '../merchant-store'

const initial: PaymentsActionState = {}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      className="gantry-toolbar-btn gantry-toolbar-btn-save"
      disabled={pending}
    >
      {pending ? 'Saving…' : 'Save merchant'}
    </button>
  )
}

function savedHint(cred: CredentialPublic | undefined, empty: string): string {
  return cred?.hasSecret ? `Saved key ends with ${cred.masked}` : empty
}

function credentialFor(
  credentials: CredentialPublic[],
  kind: string,
): CredentialPublic | undefined {
  return credentials.find((item) => item.kind === kind)
}

function panelSavedHint(
  descriptor: PaymentMethodDescriptor,
  credentials: CredentialPublic[],
): string | undefined {
  const field = descriptor.credentialSchema.fields.find((item) => item.savedHint === 'panel')
  if (!field?.emptySavedHint) return undefined
  return savedHint(credentialFor(credentials, field.kind), field.emptySavedHint)
}

function fieldInputType(input: PaymentMethodDescriptor['credentialSchema']['fields'][number]['input']) {
  if (input === 'secret') return 'password'
  if (input === 'email') return 'email'
  if (input === 'url') return 'url'
  return 'text'
}

function offerHint(on: boolean, ready: boolean, active: boolean, missing: string): string {
  if (!on) return 'Off. Buyers paying this seller will not see this method.'
  if (!active) return 'On. Buyers see it after this seller is Active and the fields are saved.'
  if (!ready) return `On. Not offered until ${missing}.`
  return 'On. Buyers paying this seller can use this method.'
}

function MethodOfferPanel({
  title,
  method,
  on,
  pending,
  ready,
  active,
  missing,
  hintExtra,
  onToggle,
  children,
}: {
  title: string
  method: PaymentMethodKind
  on: boolean
  pending: boolean
  ready: boolean
  active: boolean
  missing: string
  hintExtra?: string
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section className={on ? 'page-settings-panel' : 'page-settings-panel is-off'}>
      <header className="page-settings-panel-head">
        <h3>{title}</h3>
        <div className="cms-switch page-settings-panel-head-switch">
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`${title} offer at checkout`}
            className={on ? 'cms-switch-track is-on' : 'cms-switch-track'}
            disabled={pending}
            onClick={(event) => {
              event.preventDefault()
              onToggle()
            }}
          >
            <span className="cms-switch-thumb" />
          </button>
          <span className={on ? 'cms-switch-label is-on' : 'cms-switch-label is-off'}>
            {on ? 'On' : 'Off'}
          </span>
        </div>
      </header>
      <div className="page-settings-panel-body">
        <p className="settings-hint">
          {offerHint(on, ready, active, missing)}
          {hintExtra ? ` ${hintExtra}` : ''}
        </p>
        {children}
      </div>
    </section>
  )
}

export function MerchantSettingsForm({
  merchant,
  credentials,
  onlineMethods,
  accountEmail,
  accountName,
}: {
  merchant: MerchantRecord
  credentials: CredentialPublic[]
  onlineMethods: PaymentMethodDescriptor[]
  accountEmail?: string
  accountName?: string
}) {
  const router = useRouter()
  const [state, action, pending] = useActionState(saveMerchantProfileAction, initial)
  const [methods, setMethods] = React.useState<PaymentMethodKind[]>(merchant.enabledMethods)
  const sellerActive = merchant.status === 'active'

  function toggle(method: PaymentMethodKind) {
    setMethods((prev) =>
      prev.includes(method) ? prev.filter((item) => item !== method) : [...prev, method],
    )
  }

  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])
  const enabledKey = merchant.enabledMethods.join(',')
  useEffect(() => {
    setMethods(merchant.enabledMethods)
    // Sync after server refresh — compare by value, not array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enabledKey mirrors enabledMethods
  }, [enabledKey])

  const billing = credentials.find((c) => c.kind === 'billingo' || c.kind === 'szamlazz')
  const formFeedback =
    state.error || (state.ok && state.message) ? (
      state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : (
        <p className="admin-inline-ok" role="status">
          {state.message}
        </p>
      )
    ) : null

  return (
    <form action={action} className="sf-payments-merchant">
      <input type="hidden" name="userId" value={merchant.userId} />
      <input type="hidden" name="enabledMethods" value={methods.join(',')} />
      <div className="page-settings-actions">
        <SaveButton pending={pending} />
        {formFeedback}
      </div>

      <div className="admin-settings-mosaic">
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Merchant profile</h3>
          </header>
          <div className="page-settings-panel-body">
            <p className="settings-hint">
              Own gateway keys settle to this seller&apos;s bank. Flat premium subscription unlocks
              collect — no platform % fee for now.
            </p>
            {accountEmail ? (
              <label className="settings-field">
                <span>Account</span>
                <input
                  type="text"
                  value={accountName ? `${accountName} · ${accountEmail}` : accountEmail}
                  readOnly
                  disabled
                />
              </label>
            ) : null}
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
          </div>
        </section>
      </div>

      <div className="admin-settings-mosaic-section">
        <h3>Payment methods</h3>
        <p className="settings-hint">
          Ways this seller can get paid at checkout. Turn a method on when the fields below are
          ready — bank transfer, pay at entrance, cash, and online gateways.
        </p>
      </div>

      <div className="admin-settings-mosaic sf-payments-method-mosaic">
        <MethodOfferPanel
          title="Bank transfer"
          method="bank_transfer"
          on={methods.includes('bank_transfer')}
          pending={pending}
          ready={offlineMerchantMethodReady('bank_transfer', merchant) === true}
          active={sellerActive}
          missing="an IBAN is saved"
          onToggle={() => toggle('bank_transfer')}
        >
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
        </MethodOfferPanel>

        <MethodOfferPanel
          title="Pay at entrance"
          method="pay_at_entrance"
          on={methods.includes('pay_at_entrance')}
          pending={pending}
          ready={offlineMerchantMethodReady('pay_at_entrance', merchant) === true}
          active={sellerActive}
          missing="instructions are saved"
          onToggle={() => toggle('pay_at_entrance')}
        >
          <label className="settings-field">
            <span>Instructions</span>
            <textarea
              name="entranceInstructions"
              defaultValue={merchant.entranceInstructions}
              rows={3}
              disabled={pending}
            />
          </label>
        </MethodOfferPanel>

        <MethodOfferPanel
          title="Cash"
          method="cash"
          on={methods.includes('cash')}
          pending={pending}
          ready={offlineMerchantMethodReady('cash', merchant) === true}
          active={sellerActive}
          missing="instructions are saved"
          onToggle={() => toggle('cash')}
        >
          <label className="settings-field">
            <span>Instructions</span>
            <textarea
              name="cashInstructions"
              defaultValue={merchant.cashInstructions}
              rows={3}
              disabled={pending}
            />
          </label>
        </MethodOfferPanel>

        {onlineMethods.map((descriptor) => (
          <MethodOfferPanel
            key={descriptor.id}
            title={descriptor.label}
            method={descriptor.id}
            on={methods.includes(descriptor.id)}
            pending={pending}
            ready={paymentMethodCredentialsReady(descriptor, credentials)}
            active={sellerActive}
            missing={descriptor.missingReady}
            hintExtra={panelSavedHint(descriptor, credentials)}
            onToggle={() => toggle(descriptor.id)}
          >
            {descriptor.credentialSchema.fields.map((field) => {
              const cred = credentialFor(credentials, field.kind)
              const metaDefault =
                field.bind === 'meta' ? String(cred?.meta?.[field.metaKey || ''] ?? '') : undefined
              return (
                <React.Fragment key={field.name}>
                  {field.savedHint === 'inline' && field.emptySavedHint ? (
                    <p className="settings-hint">{savedHint(cred, field.emptySavedHint)}</p>
                  ) : null}
                  <label className="settings-field">
                    <span>{field.label}</span>
                    <input
                      name={field.name}
                      type={fieldInputType(field.input)}
                      defaultValue={field.bind === 'meta' ? metaDefault : undefined}
                      placeholder={field.placeholder}
                      autoComplete={field.input === 'email' ? 'email' : 'off'}
                      spellCheck={field.spellCheck === false ? false : undefined}
                      disabled={pending}
                    />
                  </label>
                </React.Fragment>
              )
            })}
          </MethodOfferPanel>
        ))}
      </div>

      <div className="page-settings-actions">
        <SaveButton pending={pending} />
        {formFeedback}
      </div>
    </form>
  )
}
