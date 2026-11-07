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
  /** Hide event picker when embedded on the event editor. */
  embedded?: boolean
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

/**
 * Per-event ticket types — EB-style: add/manage rows under the event.
 * Global `/admin/events/tiers` is only a cross-event shortcut (pick event → same UI).
 */
export function TiersManager({ events, eventId, tiers, embedded = false }: Props) {
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
  const eventTitle = events.find((e) => e.id === eventId)?.title

  return (
    <div className="sf-events-tiers-manager admin-settings-mosaic">
      {embedded ? null : (
        <section className="outlines-create" aria-label="Select event">
          <h3>Choose event</h3>
          <p className="settings-hint">
            Ticket types belong to one event (EB approach). Prefer managing them on the event
            editor; this page is a shortcut across events.
          </p>
          <div className="sf-events-filters">
            <div className="sf-events-filter-group" role="group" aria-label="Events">
              {events.length === 0 ? (
                <p className="admin-empty">
                  Create an <Link href="/admin/events">event</Link> first.
                </p>
              ) : (
                events.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/admin/events/tiers?eventId=${encodeURIComponent(ev.id)}`}
                    className={`gantry-toolbar-btn gantry-toolbar-btn-muted${
                      eventId === ev.id ? ' is-active' : ''
                    }`}
                    aria-current={eventId === ev.id ? 'true' : undefined}
                  >
                    {ev.title}
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      )}

      {!eventId || events.length === 0 ? null : (
        <section className="outlines-create" aria-label="Ticket types for event">
          {!embedded ? (
            <h3>
              Ticket types
              {eventTitle ? (
                <>
                  {' '}
                  —{' '}
                  <Link href={`/admin/events/${encodeURIComponent(eventId)}`}>{eventTitle}</Link>
                </>
              ) : null}
            </h3>
          ) : null}
          <p className="settings-hint">
            Rows are this event’s ticket / faction slots (price label, capacity, description).
            Public page lists them; signup select skips sold-out options. Payments stay deferred.
          </p>

          <Feedback state={createState} />
          <Feedback state={updateState} />
          <Feedback state={deleteState} />

          <div className="outlines-table-wrap sf-events-tiers-table-wrap">
            <table className="outlines-table sf-events-tiers-table">
              <thead>
                <tr>
                  <th scope="col">Title</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Price</th>
                  <th scope="col">Capacity</th>
                  <th scope="col">Registered</th>
                  <th scope="col">Sort</th>
                  <th scope="col">Description</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="admin-empty">
                      No ticket types yet — add a row below. Without tiers, public signup skips
                      the ticket select.
                    </td>
                  </tr>
                ) : (
                  tiers.map((row) => (
                    <tr key={row.id}>
                      <td colSpan={8} className="sf-events-tiers-row-cell">
                        <div className="sf-events-tiers-row-shell">
                          <form
                            action={updateAction}
                            className="sf-events-tiers-row-form"
                          >
                            <input type="hidden" name="id" value={row.id} />
                            <input type="hidden" name="eventId" value={row.eventId} />
                            <label className="settings-field">
                              <span className="sr-only">Title</span>
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
                              <span className="sr-only">Kind</span>
                              <select name="kind" defaultValue={row.kind} disabled={busy}>
                                {TICKET_TIER_KINDS.map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="settings-field">
                              <span className="sr-only">Price</span>
                              <input
                                type="text"
                                name="priceLabel"
                                maxLength={80}
                                defaultValue={row.priceLabel}
                                disabled={busy}
                                placeholder="Free / 5 000 Ft"
                              />
                            </label>
                            <label className="settings-field">
                              <span className="sr-only">Capacity</span>
                              <input
                                type="number"
                                name="capacity"
                                min={0}
                                step={1}
                                defaultValue={row.capacity ?? ''}
                                disabled={busy}
                                placeholder="∞"
                              />
                            </label>
                            <div
                              className="sf-events-tiers-registered settings-hint"
                              title="Registered guests on this tier"
                            >
                              {typeof row.capacity === 'number'
                                ? `${row.occupied}/${row.capacity}`
                                : String(row.occupied)}
                            </div>
                            <label className="settings-field">
                              <span className="sr-only">Sort</span>
                              <input
                                type="number"
                                name="sortOrder"
                                step={1}
                                defaultValue={row.sortOrder}
                                disabled={busy}
                              />
                            </label>
                            <label className="settings-field sf-events-tiers-desc">
                              <span className="sr-only">Description</span>
                              <input
                                type="text"
                                name="description"
                                maxLength={2000}
                                defaultValue={row.description}
                                disabled={busy}
                                placeholder="Public description"
                              />
                            </label>
                            <div className="sf-events-tiers-row-actions">
                              <button
                                type="submit"
                                className="gantry-toolbar-btn gantry-toolbar-btn-save"
                                disabled={busy}
                              >
                                {updatePending ? '…' : 'Save'}
                              </button>
                            </div>
                          </form>
                          <form action={deleteAction} className="sf-events-tiers-delete">
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
                              {deletePending ? '…' : 'Delete'}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <form action={createAction} className="sf-events-tiers-add-form">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="sortOrder" value={tiers.length} />
            <h4 className="sf-events-tiers-add-title">Add ticket type</h4>
            <div className="sf-events-tiers-add-grid">
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
                <span>Price</span>
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
                <span>Capacity</span>
                <input
                  type="number"
                  name="capacity"
                  min={0}
                  step={1}
                  disabled={busy}
                  placeholder="Unlimited"
                />
              </label>
              <label className="settings-field sf-events-tiers-desc">
                <span>Description</span>
                <input
                  type="text"
                  name="description"
                  maxLength={2000}
                  disabled={busy}
                  placeholder="Shown on the public event page"
                />
              </label>
              <div className="sf-events-tiers-add-actions">
                <button
                  type="submit"
                  className="gantry-toolbar-btn gantry-toolbar-btn-save"
                  disabled={createPending}
                >
                  {createPending ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}
