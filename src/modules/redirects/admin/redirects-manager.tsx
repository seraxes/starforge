'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createRedirectAction,
  deleteRedirectAction,
  importRedirectsCsvAction,
  toggleRedirectEnabledAction,
  updateRedirectAction,
  type RedirectAdminActionState,
} from '../actions'
import { REDIRECT_STATUS_CODES } from '../types'

type RedirectRow = {
  id: string
  fromPath: string
  toPath: string
  statusCode: number
  enabled: boolean
  note: string
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
  const [createState, createAction, createPending] = useActionState(
    createRedirectAction,
    initial,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateRedirectAction,
    initial,
  )
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleRedirectEnabledAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteRedirectAction,
    initial,
  )
  const [importState, importAction, importPending] = useActionState(
    importRedirectsCsvAction,
    initial,
  )

  useNotifySavedOnOk(createState)
  useNotifySavedOnOk(updateState)
  useNotifySavedOnOk(toggleState)
  useNotifySavedOnOk(deleteState)
  useNotifySavedOnOk(importState)

  useEffect(() => {
    if (
      createState.ok ||
      updateState.ok ||
      toggleState.ok ||
      deleteState.ok ||
      importState.ok
    ) {
      router.refresh()
    }
  }, [createState, updateState, toggleState, deleteState, importState, router])

  const busy =
    createPending || updatePending || togglePending || deletePending || importPending

  return (
    <div className="sf-redirects-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Create redirect">
        <h3>Add redirect</h3>
        <form action={createAction} className="outlines-create-form admin-create-form">
          <label className="settings-field">
            <span>From path</span>
            <input
              type="text"
              name="fromPath"
              placeholder="/old-page (no /en or /hu)"
              required
              maxLength={512}
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>To path or URL</span>
            <input
              type="text"
              name="toPath"
              placeholder="/new-page or https://…"
              required
              maxLength={2048}
              autoComplete="off"
            />
          </label>
          <label className="settings-field">
            <span>Status</span>
            <select name="statusCode" defaultValue="301">
              {REDIRECT_STATUS_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                  {code === 301 ? ' (permanent)' : code === 302 ? ' (temporary)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Note (optional)</span>
            <input type="text" name="note" placeholder="Why this redirect exists" maxLength={200} />
          </label>
          <input type="hidden" name="enabled" value="1" />
          <button
            type="submit"
            className="gantry-toolbar-btn gantry-toolbar-btn-save"
            disabled={createPending}
          >
            {createPending ? 'Adding…' : 'Add'}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <section className="outlines-create" aria-label="Import redirects CSV">
        <h3>Import CSV</h3>
        <form
          action={importAction}
          className="outlines-create-form admin-create-form sf-redirects-import-form"
        >
          <label className="settings-field">
            <span>CSV file</span>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv,text/plain"
              required
              disabled={importPending}
            />
          </label>
          <p className="settings-hint">
            Header row: <code>from,to,status,enabled,note</code>. Invalid rows are skipped.
            Matching from paths update to, status, enabled, and note.
          </p>
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={importPending}
            >
              {importPending ? 'Importing…' : 'Import'}
            </button>
          </div>
        </form>
        <Feedback state={importState} />
      </section>

      <Feedback state={updateState} />
      <Feedback state={toggleState} />
      <Feedback state={deleteState} />

      <div className="outlines-table-wrap admin-settings-panel-wide">
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
                <td colSpan={6}>
                  <p className="admin-empty">No redirects yet. Add one above.</p>
                </td>
              </tr>
            ) : (
              redirects.map((row) => (
                <tr key={row.id} data-enabled={row.enabled ? '1' : '0'}>
                  <td colSpan={6}>
                    <form action={updateAction} className="sf-redirect-row-form admin-create-form">
                      <input type="hidden" name="id" value={row.id} />
                      <div className="sf-redirect-row-grid">
                        <label className="settings-field">
                          <span className="visually-hidden">From</span>
                          <input
                            type="text"
                            name="fromPath"
                            defaultValue={row.fromPath}
                            required
                            maxLength={512}
                            disabled={busy}
                          />
                        </label>
                        <label className="settings-field">
                          <span className="visually-hidden">To</span>
                          <input
                            type="text"
                            name="toPath"
                            defaultValue={row.toPath}
                            required
                            maxLength={2048}
                            disabled={busy}
                          />
                        </label>
                        <label className="settings-field">
                          <span className="visually-hidden">Status</span>
                          <select
                            name="statusCode"
                            defaultValue={String(row.statusCode)}
                            disabled={busy}
                          >
                            {REDIRECT_STATUS_CODES.map((code) => (
                              <option key={code} value={code}>
                                {code}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="outlines-check">
                          <input
                            type="checkbox"
                            name="enabled"
                            value="1"
                            defaultChecked={row.enabled}
                            disabled={busy}
                          />
                          <span>On</span>
                        </label>
                        <span className="admin-muted">{formatUpdated(row.updatedAt)}</span>
                        <div className="sf-redirect-row-actions">
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-save"
                            disabled={updatePending}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                      {row.note ? (
                        <p className="admin-muted sf-redirect-note">{row.note}</p>
                      ) : null}
                    </form>
                    <div className="sf-redirect-row-secondary">
                      <form action={toggleAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={row.enabled ? '0' : '1'}
                        />
                        <button
                          type="submit"
                          className="gantry-toolbar-btn"
                          disabled={togglePending}
                        >
                          {row.enabled ? 'Disable' : 'Enable'}
                        </button>
                      </form>
                      <form action={deleteAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="gantry-toolbar-btn gantry-toolbar-btn-danger"
                          disabled={deletePending}
                          onClick={(e) => {
                            if (
                              !window.confirm(
                                `Delete redirect ${row.fromPath} → ${row.toPath}?`,
                              )
                            ) {
                              e.preventDefault()
                            }
                          }}
                        >
                          Delete
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
    </div>
  )
}
