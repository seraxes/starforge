'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createTicketTierAction,
  deleteTicketTierAction,
  updateTicketTierAction,
  type EventsAdminActionState,
} from '../actions'
import { TICKET_TIER_KINDS } from '../types'

type EventOpt = { id: string; title: string }

type TierRow = {
  id: string
  eventId: string
  title: string
  description: string
  kind: string
  capacity: number | null
  priceLabel: string
  sortOrder: number
  occupied: number
  updatedAt: string
}

type Props = {
  events: EventOpt[]
  eventId: string
  tiers: TierRow[]
}

const initial: EventsAdminActionState = {}

function Feedback({ state }: { state: EventsAdminActionState }) {
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

export function TiersManager({ events, eventId, tiers }: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createTicketTierAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateTicketTierAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTicketTierAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(deleteState)

  useEffect(() => {
    if (createState.ok || updateState.ok || deleteState.ok) {
      router.refresh()
    }
  }, [createState, updateState, deleteState, router])

  const busy = createPending || updatePending || deletePending

  return (
    <div className="sf-events-tiers-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Select event">
        <h3>Event</h3>
        <div className="admin-inline-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {events.length === 0 ? (
            <p className="admin-empty">
              Create an <Link href="/admin/events">event</Link> first.
            </p>
          ) : (
            events.map((ev) => (
              <Link
                key={ev.id}
                href={`/admin/events/tiers?eventId=${encodeURIComponent(ev.id)}`}
                className={
                  eventId === ev.id ? 'gantry-btn gantry-btn-primary' : 'gantry-btn'
                }
              >
                {ev.title}
              </Link>
            ))
          )}
        </div>
      </section>

      {!eventId || events.length === 0 ? null : (
        <>
          <section className="outlines-create" aria-label="Create ticket tier">
            <h3>Add ticket tier</h3>
            <p className="settings-hint">
              General tickets or faction slots. Capacity is optional (empty = unlimited for
              this tier; event capacity still applies).
            </p>
            <form action={createAction} className="outlines-create-form admin-create-form">
              <input type="hidden" name="eventId" value={eventId} />
              <label className="settings-field">
                <span>Title</span>
                <input
                  type="text"
                  name="title"
                  required
                  maxLength={200}
                  disabled={busy}
                  autoComplete="off"
                  placeholder="General / Blue team"
                />
              </label>
              <label className="settings-field">
                <span>Kind</span>
                <select name="kind" defaultValue="general" disabled={busy}>
                  {TICKET_TIER_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Capacity (optional)</span>
                <input
                  type="number"
                  name="capacity"
                  min={0}
                  step={1}
                  disabled={busy}
                  placeholder="Unlimited"
                />
              </label>
              <label className="settings-field">
                <span>Price label</span>
                <input
                  type="text"
                  name="priceLabel"
                  maxLength={80}
                  disabled={busy}
                  autoComplete="off"
                  placeholder="Free / 5 000 Ft"
                />
              </label>
              <label className="settings-field">
                <span>Sort order</span>
                <input
                  type="number"
                  name="sortOrder"
                  defaultValue={0}
                  step={1}
                  disabled={busy}
                />
              </label>
              <label className="settings-field">
                <span>Description</span>
                <textarea
                  name="description"
                  rows={2}
                  maxLength={2000}
                  disabled={busy}
                  placeholder="Optional notes shown to admins"
                />
              </label>
              <button
                type="submit"
                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                disabled={createPending}
              >
                {createPending ? 'Adding…' : 'Add tier'}
              </button>
            </form>
            <Feedback state={createState} />
          </section>

          <Feedback state={updateState} />
          <Feedback state={deleteState} />

          {tiers.length === 0 ? (
            <section className="outlines-create" aria-label="Tiers list">
              <h3>No tiers yet</h3>
              <p className="admin-empty">
                Without tiers, public signup skips the ticket select. Add at least one for
                faction / priced slots.
              </p>
            </section>
          ) : (
            tiers.map((row) => (
              <section
                key={row.id}
                className="outlines-create"
                aria-label={`Edit tier ${row.title}`}
              >
                <h3>
                  {row.title}{' '}
                  <span className="settings-hint">
                    ({row.kind}
                    {typeof row.capacity === 'number'
                      ? ` · ${row.occupied}/${row.capacity}`
                      : ` · ${row.occupied} registered`}
                    )
                  </span>
                </h3>
                <form
                  id={`tier-edit-${row.id}`}
                  action={updateAction}
                  className="outlines-create-form admin-create-form"
                >
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="eventId" value={row.eventId} />
                  <label className="settings-field">
                    <span>Title</span>
                    <input
                      type="text"
                      name="title"
                      required
                      maxLength={200}
                      defaultValue={row.title}
                      disabled={busy}
                    />
                  </label>
                  <label className="settings-field">
                    <span>Kind</span>
                    <select name="kind" defaultValue={row.kind} disabled={busy}>
                      {TICKET_TIER_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field">
                    <span>Capacity (optional)</span>
                    <input
                      type="number"
                      name="capacity"
                      min={0}
                      step={1}
                      defaultValue={row.capacity ?? ''}
                      disabled={busy}
                      placeholder="Unlimited"
                    />
                  </label>
                  <label className="settings-field">
                    <span>Price label</span>
                    <input
                      type="text"
                      name="priceLabel"
                      maxLength={80}
                      defaultValue={row.priceLabel}
                      disabled={busy}
                    />
                  </label>
                  <label className="settings-field">
                    <span>Sort order</span>
                    <input
                      type="number"
                      name="sortOrder"
                      step={1}
                      defaultValue={row.sortOrder}
                      disabled={busy}
                    />
                  </label>
                  <label className="settings-field">
                    <span>Description</span>
                    <textarea
                      name="description"
                      rows={2}
                      maxLength={2000}
                      defaultValue={row.description}
                      disabled={busy}
                    />
                  </label>
                </form>
                <div className="admin-action-row">
                  <button
                    type="submit"
                    form={`tier-edit-${row.id}`}
                    className="gantry-toolbar-btn gantry-toolbar-btn-save"
                    disabled={busy}
                  >
                    {updatePending ? 'Saving…' : 'Save'}
                  </button>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                      disabled={busy}
                      onClick={(e) => {
                        if (!window.confirm(`Delete tier “${row.title}”?`)) {
                          e.preventDefault()
                        }
                      }}
                    >
                      {deletePending ? 'Deleting…' : 'Delete'}
                    </button>
                  </form>
                </div>
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}
