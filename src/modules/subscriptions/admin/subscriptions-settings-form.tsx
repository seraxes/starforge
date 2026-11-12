'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  saveSubscriptionsSettingsAction,
  seedSubscriptionsEmailStartersAction,
  type SubscriptionsActionState,
} from '../actions'
import type { SubscriptionsModuleSettings } from '../types'

const initial: SubscriptionsActionState = {}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={pending}>
      {pending ? 'Saving…' : 'Save settings'}
    </button>
  )
}

type Props = {
  settings: SubscriptionsModuleSettings
}

export function SubscriptionsSettingsForm({ settings }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(saveSubscriptionsSettingsAction, initial)
  const [seedState, seedAction, seedPending] = useActionState(
    seedSubscriptionsEmailStartersAction,
    initial,
  )
  useNotifySavedOnOk(state)
  useNotifySavedOnOk(seedState)
  useEffect(() => {
    if (state.ok || seedState.ok) router.refresh()
  }, [state.ok, seedState.ok, router])

  const busy = pending || seedPending

  return (
    <div className="sf-subscriptions-settings">
      <form action={formAction}>
        <div className="page-settings-actions" style={{ marginBottom: '1rem' }}>
          <SaveButton pending={pending} />
        </div>

        <div className="admin-settings-mosaic">
          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Reminders</h3>
            </header>
            <div className="page-settings-panel-body">
              <label className="settings-field">
                <span>Expiring-soon days</span>
                <input
                  type="number"
                  name="reminderDays"
                  min={0}
                  max={365}
                  step={1}
                  defaultValue={settings.reminderDays}
                  disabled={busy}
                />
                <span className="settings-hint">
                  Emit <code>product:subscriptions/expiring_soon</code> this many days before{' '}
                  <code>endsAt</code>. Templates live under{' '}
                  <Link href="/admin/email">Email Manager</Link>.
                </span>
              </label>
              <label className="settings-field">
                <span>Trial-ending days</span>
                <input
                  type="number"
                  name="trialReminderDays"
                  min={0}
                  max={365}
                  step={1}
                  defaultValue={settings.trialReminderDays}
                  disabled={busy}
                />
                <span className="settings-hint">
                  Emit <code>product:subscriptions/trial_ending</code> this many days before a trial
                  ends.
                </span>
              </label>
            </div>
          </section>

          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Plan defaults</h3>
            </header>
            <div className="page-settings-panel-body">
              <label className="settings-field">
                <span>Default grace hours</span>
                <input
                  type="number"
                  name="defaultGraceHours"
                  min={0}
                  max={720}
                  step={1}
                  defaultValue={settings.defaultGraceHours}
                  disabled={busy}
                />
                <span className="settings-hint">
                  Suggested value when creating a plan (each plan still stores its own grace).
                </span>
              </label>
              <label className="settings-field">
                <span>Default Forms definition id</span>
                <input
                  type="text"
                  name="defaultFormDefinitionId"
                  defaultValue={settings.defaultFormDefinitionId}
                  disabled={busy}
                  autoComplete="off"
                  placeholder="subscription-registration"
                />
                <span className="settings-hint">
                  Suggested intake form for new plans. Edit fields in{' '}
                  <Link href="/admin/forms">Forms</Link>.
                </span>
              </label>
            </div>
          </section>

          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Related owners</h3>
            </header>
            <div className="page-settings-panel-body">
              <p className="settings-hint">
                Money and coupons stay in Payments. Mail copy stays in Email Manager. Groups and ACL
                matrix stay under Users. Module on/off is under Site Settings → Modules.
              </p>
              <p className="admin-inline-actions">
                <Link className="gantry-toolbar-btn gantry-toolbar-btn-muted" href="/admin/payments">
                  Payments
                </Link>
                <Link
                  className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                  href="/admin/payments/coupons"
                >
                  Coupons
                </Link>
                <Link className="gantry-toolbar-btn gantry-toolbar-btn-muted" href="/admin/email">
                  Email
                </Link>
                <Link className="gantry-toolbar-btn gantry-toolbar-btn-muted" href="/admin/forms">
                  Forms
                </Link>
                <Link className="gantry-toolbar-btn gantry-toolbar-btn-muted" href="/admin/users">
                  Users / ACL
                </Link>
                <Link className="gantry-toolbar-btn gantry-toolbar-btn-muted" href="/admin/settings">
                  Modules
                </Link>
              </p>
            </div>
          </section>
        </div>

        {state.error ? (
          <p className="admin-inline-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="admin-inline-ok" role="status">
            Saved.
          </p>
        ) : null}

        <div className="page-settings-actions" style={{ marginTop: '1rem' }}>
          <SaveButton pending={pending} />
        </div>
      </form>

      <section className="page-settings-panel" style={{ marginTop: '1.5rem' }}>
        <header className="page-settings-panel-head">
          <h3>Subscription emails</h3>
        </header>
        <div className="page-settings-panel-body">
          <p className="settings-hint">
            Seeds Email Manager templates + rules for activated, renewed, upgraded, expiring_soon,
            trial_ending, and expired (audience <code>buyerEmail</code>). Reminder timing uses the
            days above; JobRunner emits the triggers.
          </p>
          <form action={seedAction}>
            <div className="page-settings-actions">
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={busy}
              >
                {seedPending ? 'Seeding…' : 'Seed subscription emails'}
              </button>
              <Link className="gantry-toolbar-btn gantry-toolbar-btn-muted" href="/admin/email">
                Open Email Manager
              </Link>
            </div>
          </form>
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
