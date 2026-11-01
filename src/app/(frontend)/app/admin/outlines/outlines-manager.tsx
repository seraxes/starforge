'use client'

import React, { useActionState, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createOutlineAction,
  deleteOutlineAction,
  duplicateOutlineAction,
  renameOutlineAction,
  type OutlineActionState,
} from '@/core/modules/outline-actions'

type OutlineRow = {
  id: string
  label: string
  updatedAt: string
  isDefault: boolean
}

type Props = {
  outlines: OutlineRow[]
}

const initial: OutlineActionState = {}

function Feedback({ state }: { state: OutlineActionState }) {
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

export function OutlinesManager({ outlines }: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(createOutlineAction, initial)
  const [renameState, renameAction, renamePending] = useActionState(renameOutlineAction, initial)
  const [dupState, dupAction, dupPending] = useActionState(duplicateOutlineAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteOutlineAction, initial)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const refresh = () => router.refresh()

  return (
    <div className="outlines-manager">
      <section className="outlines-create" aria-label="Create outline">
        <h3>Create outline</h3>
        <form action={createAction} className="outlines-create-form admin-create-form" onSubmit={() => setTimeout(refresh, 50)}>
          <label className="settings-field">
            <span>Name</span>
            <input type="text" name="label" placeholder="e.g. Home" required maxLength={80} />
          </label>
          <label className="settings-field">
            <span>Id (optional)</span>
            <input type="text" name="id" placeholder="auto from name" maxLength={64} />
          </label>
          <label className="settings-field">
            <span>Copy from</span>
            <select name="copyFromId" defaultValue="">
              <option value="">Default layout seed</option>
              {outlines.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} ({o.id})
                </option>
              ))}
            </select>
          </label>
          <label className="outlines-check">
            <input type="checkbox" name="openAfter" value="1" defaultChecked />
            <span>Open in Layout after create</span>
          </label>
          <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={createPending}>
            {createPending ? 'Creating…' : 'Create'}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={renameState} />
      <Feedback state={dupState} />
      <Feedback state={deleteState} />

      <div className="outlines-table-wrap">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Id</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {outlines.map((outline) => (
              <tr key={outline.id}>
                <td>
                  <strong>{outline.label}</strong>
                  {outline.isDefault ? <span className="outlines-badge">Base</span> : null}
                </td>
                <td>
                  <code>{outline.id}</code>
                </td>
                <td className="outlines-muted">{formatUpdated(outline.updatedAt)}</td>
                <td>
                  <div className="outlines-actions">
                    <Link
                      className="button-link"
                      href={`/app/admin/layouts?outline=${encodeURIComponent(outline.id)}`}
                    >
                      Select
                    </Link>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setRenamingId(renamingId === outline.id ? null : outline.id)
                        setDuplicatingId(null)
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setDuplicatingId(duplicatingId === outline.id ? null : outline.id)
                        setRenamingId(null)
                      }}
                    >
                      Duplicate
                    </button>
                    {outline.isDefault ? null : (
                      <form
                        action={deleteAction}
                        onSubmit={(e) => {
                          if (
                            !window.confirm(
                              `Delete outline “${outline.label}” (${outline.id})? Pages still assigned to it will fall back to Default.`,
                            )
                          ) {
                            e.preventDefault()
                          } else {
                            setTimeout(refresh, 50)
                          }
                        }}
                      >
                        <input type="hidden" name="layoutId" value={outline.id} />
                        <button
                          type="submit"
                          className="gantry-toolbar-btn gantry-toolbar-btn-danger danger"
                          disabled={deletePending}
                        >
                          Delete
                        </button>
                      </form>
                    )}
                  </div>

                  {renamingId === outline.id ? (
                    <form
                      action={renameAction}
                      className="outlines-inline-form"
                      onSubmit={() => {
                        setRenamingId(null)
                        setTimeout(refresh, 50)
                      }}
                    >
                      <input type="hidden" name="layoutId" value={outline.id} />
                      <input
                        type="text"
                        name="label"
                        defaultValue={outline.label}
                        required
                        maxLength={80}
                        aria-label="New outline name"
                        autoFocus
                        onBlur={(e) => {
                          if (e.currentTarget.form && e.currentTarget.value.trim()) {
                            e.currentTarget.form.requestSubmit()
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            ;(e.target as HTMLInputElement).blur()
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="gantry-toolbar-btn gantry-toolbar-btn-quiet"
                        onClick={() => setRenamingId(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : null}

                  {duplicatingId === outline.id ? (
                    <form
                      action={dupAction}
                      className="outlines-inline-form"
                      onSubmit={() => {
                        setDuplicatingId(null)
                        setTimeout(refresh, 50)
                      }}
                    >
                      <input type="hidden" name="sourceId" value={outline.id} />
                      <input type="hidden" name="openAfter" value="1" />
                      <input
                        type="text"
                        name="label"
                        defaultValue={`${outline.label} copy`}
                        required
                        maxLength={80}
                        aria-label="Duplicate outline name"
                      />
                      <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={dupPending}>
                        {dupPending ? 'Copying…' : 'Create copy'}
                      </button>
                      <button
                        type="button"
                        className="gantry-toolbar-btn gantry-toolbar-btn-quiet"
                        onClick={() => setDuplicatingId(null)}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
