'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  inviteOnboardingPersonAction,
  seedOnboardingEmailStartersAction,
  type OnboardingAdminActionState,
} from '../actions'

const initial: OnboardingAdminActionState = {}

type WorkerRow = {
  userId: string
  name: string
  email: string
  statusId: string
  statusKey: string
  statusName: string
  phone: string
  driverCode: string
  eventCount: number
  noteCount: number
}

type StatusOpt = { id: string; key: string; name: string }

type Props = {
  workers: WorkerRow[]
  statuses: StatusOpt[]
  statusFilter: string
}

function Feedback({ state }: { state: OnboardingAdminActionState }) {
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

function InvitePanel() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [state, action, pending] = useActionState(inviteOnboardingPersonAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (!state.ok) return
    setOpen(false)
    setFormKey((k) => k + 1)
    setName('')
    setEmail('')
    setPhone('')
    router.refresh()
  }, [state.ok, router])

  return (
    <div className={`sf-onboarding-add-panel${open ? ' is-open' : ''}`} aria-label="Invite person">
      <section className="outlines-create sf-events-add-panel">
        <div className="sf-events-add-bar">
          <button
            type="button"
            className={`gantry-toolbar-btn${open ? ' gantry-toolbar-btn-muted' : ' gantry-toolbar-btn-save'}`}
            aria-expanded={open}
            aria-controls="sf-onboarding-invite-form"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Close' : 'Invite +'}
          </button>
          {!open ? (
            <p className="settings-hint sf-events-add-hint">
              Invite creates a Core user in recruiting and sends set-password + application mail.
            </p>
          ) : null}
        </div>
      </section>
      {open ? (
        <div className="sf-events-form-mosaic">
          <form
            key={formKey}
            id="sf-onboarding-invite-form"
            action={action}
            aria-label="Invite person"
            className="sf-events-form-mosaic-form"
          >
            <fieldset className="settings-fieldset sf-events-form-section sf-events-form-section-wide">
              <legend>Invite</legend>
              <label className="settings-field">
                <span>Name</span>
                <input
                  type="text"
                  name="name"
                  value={name}
                  required
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  required
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>Phone</span>
                <input
                  type="text"
                  name="phone"
                  value={phone}
                  disabled={pending}
                  autoComplete="off"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </fieldset>
          </form>
          <Feedback state={state} />
          <div className="sf-events-form-actions admin-action-row page-settings-actions">
            <button
              type="button"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="sf-onboarding-invite-form"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Inviting…' : 'Invite'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SeedStartersButton() {
  const [state, action, pending] = useActionState(seedOnboardingEmailStartersAction, initial)
  useNotifySavedOnOk(state)
  return (
    <form action={action} className="admin-control-row">
      <button
        type="submit"
        className="gantry-toolbar-btn gantry-toolbar-btn-muted"
        disabled={pending}
      >
        {pending ? 'Seeding…' : 'Seed email starters'}
      </button>
      <Feedback state={state} />
    </form>
  )
}

export function WorkersManager({ workers, statuses, statusFilter }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState(statusFilter)

  useEffect(() => {
    setFilter(statusFilter)
  }, [statusFilter])

  return (
    <div className="sf-onboarding-workers">
      <InvitePanel />

      <div className="admin-control-row" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <label className="settings-field" style={{ margin: 0 }}>
          <span className="sr-only">Filter by status</span>
          <select
            value={filter}
            aria-label="Filter by status"
            onChange={(e) => {
              const next = e.target.value
              setFilter(next)
              const qs = next ? `?statusId=${encodeURIComponent(next)}` : ''
              router.push(`/admin/onboarding${qs}`)
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <SeedStartersButton />
      </div>

      {workers.length === 0 ? (
        <p className="settings-hint">No people yet. Invite someone to place them in recruiting.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Status</th>
                <th>Phone</th>
                <th>Events</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((row) => (
                <tr key={row.userId}>
                  <td>
                    <Link href={`/admin/onboarding/people/${encodeURIComponent(row.userId)}`}>
                      {row.name || row.email}
                    </Link>
                    <div className="settings-hint">{row.email}</div>
                  </td>
                  <td>{row.statusName || row.statusKey || '—'}</td>
                  <td>{row.phone || '—'}</td>
                  <td>{row.eventCount}</td>
                  <td>{row.noteCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
