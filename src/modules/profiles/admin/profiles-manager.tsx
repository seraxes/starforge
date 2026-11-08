'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  provisionMissingProfilesAction,
  setProfileStatusAction,
  type ProfilesActionState,
} from '../actions'
import type { ProfileDirectoryRow } from '../types'

type Row = Omit<ProfileDirectoryRow, 'updatedAt'> & { updatedAt: string | null }

type Props = {
  rows: Row[]
  q: string
  status: string
  totals: { users: number; profiles: number }
}

const initial: ProfilesActionState = {}

function Feedback({ state }: { state: ProfilesActionState }) {
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

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—'
}

export function ProfilesManager({ rows, q, status, totals }: Props) {
  const router = useRouter()
  const [statusState, statusAction, statusPending] = useActionState(
    setProfileStatusAction,
    initial,
  )
  const [provisionState, provisionAction, provisionPending] = useActionState(
    provisionMissingProfilesAction,
    initial,
  )
  useNotifySavedOnOk(statusState)
  useNotifySavedOnOk(provisionState)

  useEffect(() => {
    if (statusState.ok || provisionState.ok) router.refresh()
  }, [statusState, provisionState, router])

  const missing = Math.max(totals.users - totals.profiles, 0)
  const busy = statusPending || provisionPending

  return (
    <div className="sf-profiles-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Directory filters">
        <form method="get" className="admin-action-row sf-profiles-filter-bar">
          <label className="settings-field">
            <span>Search</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Name, username or email"
              maxLength={100}
            />
          </label>
          <label className="settings-field">
            <span>Status</span>
            <select name="status" defaultValue={status}>
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
              <option value="none">No profile yet</option>
            </select>
          </label>
          <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-muted">
            Filter
          </button>
        </form>
        <p className="settings-hint">
          {totals.profiles} of {totals.users} accounts have a profile.
          {missing > 0
            ? ' Profiles are created automatically the first time a member (or another module) needs one.'
            : null}
        </p>
        {missing > 0 ? (
          <form action={provisionAction} className="admin-action-row">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              disabled={busy}
            >
              {provisionPending ? 'Creating…' : `Create ${missing} missing profile${missing === 1 ? '' : 's'}`}
            </button>
          </form>
        ) : null}
      </section>

      <Feedback state={statusState} />
      <Feedback state={provisionState} />

      <section className="outlines-create" aria-label="Profiles list">
        <h3>Members</h3>
        {rows.length === 0 ? (
          <p className="admin-empty">No accounts match.</p>
        ) : (
          <div className="outlines-table-wrap sf-events-list-table-wrap">
            <table className="outlines-table sf-events-list-table">
              <thead>
                <tr>
                  <th scope="col">Member</th>
                  <th scope="col">Username</th>
                  <th scope="col">Email</th>
                  <th scope="col">Complete</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.userId}>
                    <td>
                      <Link
                        href={`/admin/profiles/${row.userId}`}
                        className="sf-events-list-title"
                      >
                        {row.displayName || row.userName || row.email}
                      </Link>
                      {row.banned ? <span className="layout-muted"> · banned</span> : null}
                    </td>
                    <td>{row.handle ? `@${row.handle}` : '—'}</td>
                    <td className="sf-events-list-wrap">{row.email}</td>
                    <td className="sf-events-list-num">
                      {row.hasProfile ? `${row.completeness}%` : '—'}
                    </td>
                    <td>{row.hasProfile ? row.status : 'no profile'}</td>
                    <td className="sf-events-list-num">{formatDate(row.updatedAt)}</td>
                    <td>
                      <div className="admin-action-row sf-events-list-row-actions">
                        <Link
                          href={`/admin/profiles/${row.userId}`}
                          className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                        >
                          Edit
                        </Link>
                        {row.hasProfile ? (
                          <form action={statusAction}>
                            <input type="hidden" name="userId" value={row.userId} />
                            <input
                              type="hidden"
                              name="status"
                              value={row.status === 'hidden' ? 'active' : 'hidden'}
                            />
                            <button
                              type="submit"
                              className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                              disabled={busy}
                            >
                              {row.status === 'hidden' ? 'Unhide' : 'Hide'}
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
