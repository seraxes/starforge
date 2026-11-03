'use client'

import React, { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  createRedirectAction,
  deleteRedirectAction,
  updateRedirectAction,
  type RedirectAdminActionState,
} from '@/core/redirects/actions'

type RedirectRow = {
  id: string
  fromPath: string
  toUrl: string
  statusCode: 301 | 302
  enabled: boolean
  note: string | null
  updatedAt: string
}

type Props = {
  redirects: RedirectRow[]
}

const initial: RedirectAdminActionState = {}

function Feedback({ state }: { state: RedirectAdminActionState }) {
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

function formatUpdated(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return d.toLocaleString()
  } catch {
    return '—'
  }
}

export function RedirectsManager({ redirects }: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(createRedirectAction, initial)
  const [updateState, updateAction, updatePending] = useActionState(updateRedirectAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteRedirectAction, initial)
  const [editingId, setEditingId] = useState<string | null>(null)

  const refresh = () => router.refresh()

  return (
    <div className="outlines-manager redirects-manager">
      <section className="outlines-create" aria-label="Create redirect">
        <h3>Add redirect</h3>
        <form
          action={createAction}
          className="outlines-create-form admin-create-form"
          onSubmit={() => setTimeout(refresh, 50)}
        >
          <label className="settings-field">
            <span>From path</span>
            <input
              type="text"
              name="fromPath"
              placeholder="/old-page"
              required
              maxLength={512}
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>To (path or URL)</span>
            <input
              type="text"
              name="toUrl"
              placeholder="/new-page or https://…"
              required
              maxLength={2048}
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>Status</span>
            <select name="statusCode" defaultValue="301">
              <option value="301">301 permanent</option>
              <option value="302">302 temporary</option>
            </select>
          </label>
          <label className="outlines-check">
            <input type="checkbox" name="enabled" value="1" defaultChecked />
            <span>Enabled</span>
          </label>
          <label className="settings-field">
            <span>Note (optional)</span>
            <input type="text" name="note" placeholder="Why this redirect exists" maxLength={500} />
          </label>
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={createPending}
          >
            {createPending ? 'Saving…' : 'Add'}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={updateState} />
      <Feedback state={deleteState} />

      <div className="outlines-table-wrap">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">To</th>
              <th scope="col">Status</th>
              <th scope="col">On</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {redirects.length === 0 ? (
              <tr>
                <td colSpan={6} className="outlines-muted">
                  No redirects yet. Add one above (e.g. <code>/old</code> → <code>/about</code>).
                </td>
              </tr>
            ) : null}
            {redirects.map((row) => (
              <React.Fragment key={row.id}>
                <tr>
                  <td>
                    <code>{row.fromPath}</code>
                  </td>
                  <td>
                    <code>{row.toUrl}</code>
                    {row.note ? (
                      <div className="outlines-muted" style={{ marginTop: '0.25rem' }}>
                        {row.note}
                      </div>
                    ) : null}
                  </td>
                  <td>{row.statusCode}</td>
                  <td>{row.enabled ? 'Yes' : 'No'}</td>
                  <td className="outlines-muted">{formatUpdated(row.updatedAt)}</td>
                  <td>
                    <div className="outlines-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setEditingId(editingId === row.id ? null : row.id)}
                      >
                        {editingId === row.id ? 'Close' : 'Edit'}
                      </button>
                      <form
                        action={deleteAction}
                        onSubmit={(e) => {
                          if (
                            !window.confirm(
                              `Delete redirect “${row.fromPath}” → “${row.toUrl}”?`,
                            )
                          ) {
                            e.preventDefault()
                          } else {
                            setTimeout(refresh, 50)
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="gantry-toolbar-btn gantry-toolbar-btn-danger danger"
                          disabled={deletePending}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
                {editingId === row.id ? (
                  <tr>
                    <td colSpan={6}>
                      <form
                        action={updateAction}
                        className="outlines-create-form admin-create-form"
                        onSubmit={() => {
                          setTimeout(() => {
                            setEditingId(null)
                            refresh()
                          }, 50)
                        }}
                      >
                        <input type="hidden" name="id" value={row.id} />
                        <label className="settings-field">
                          <span>From path</span>
                          <input
                            type="text"
                            name="fromPath"
                            defaultValue={row.fromPath}
                            required
                            maxLength={512}
                          />
                        </label>
                        <label className="settings-field">
                          <span>To (path or URL)</span>
                          <input
                            type="text"
                            name="toUrl"
                            defaultValue={row.toUrl}
                            required
                            maxLength={2048}
                          />
                        </label>
                        <label className="settings-field">
                          <span>Status</span>
                          <select name="statusCode" defaultValue={String(row.statusCode)}>
                            <option value="301">301 permanent</option>
                            <option value="302">302 temporary</option>
                          </select>
                        </label>
                        <label className="outlines-check">
                          <input
                            type="checkbox"
                            name="enabled"
                            value="1"
                            defaultChecked={row.enabled}
                          />
                          <span>Enabled</span>
                        </label>
                        <label className="settings-field">
                          <span>Note</span>
                          <input
                            type="text"
                            name="note"
                            defaultValue={row.note ?? ''}
                            maxLength={500}
                          />
                        </label>
                        <button
                          type="submit"
                          className="gantry-toolbar-btn gantry-toolbar-btn-save"
                          disabled={updatePending}
                        >
                          {updatePending ? 'Saving…' : 'Save'}
                        </button>
                      </form>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
