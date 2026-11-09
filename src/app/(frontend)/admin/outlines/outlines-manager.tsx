'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createOutlineAction,
  deleteOutlineAction,
  duplicateOutlineAction,
  renameOutlineAction,
  setOutlineInheritFromAction,
  type OutlineActionState,
} from '@/core/modules/outline-actions'

type OutlineRow = {
  id: string
  label: string
  updatedAt: string
  /** Core bootstrap row `default` (not a skin Base). */
  isCoreDefault: boolean
  /** Active skin’s Base shell (`preferredDefaultOutlineId`). */
  isSkinBase: boolean
  inheritFrom?: string | null
  skinId?: string | null
  skinOwned?: boolean
}

type Props = {
  outlines: OutlineRow[]
  activeSkinId: string
  activeSkinLabel: string
  baseOutlineId: string | null
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

export function OutlinesManager({
  outlines,
  activeSkinId,
  baseOutlineId,
}: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(createOutlineAction, initial)
  const [renameState, renameAction] = useActionState(renameOutlineAction, initial)
  const [dupState, dupAction, dupPending] = useActionState(duplicateOutlineAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteOutlineAction, initial)
  const [inheritState, inheritAction, inheritPending] = useActionState(
    setOutlineInheritFromAction,
    initial,
  )

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [createSourceId, setCreateSourceId] = useState(baseOutlineId ?? '')
  const [createMode, setCreateMode] = useState<'inherit' | 'copy'>('inherit')

  useEffect(() => {
    if (baseOutlineId && !createSourceId) setCreateSourceId(baseOutlineId)
  }, [baseOutlineId, createSourceId])

  const refresh = () => router.refresh()
  const parentOptions = outlines.filter((o) => !o.isCoreDefault || o.isSkinBase)
  const sourceOptions = outlines.filter((o) => !o.isCoreDefault || o.isSkinBase)

  return (
    <div className="outlines-manager">
      <section className="outlines-create" aria-label="Create outline">
        <h3>Create outline</h3>
        <form
          action={createAction}
          className="outlines-create-form admin-create-form"
          onSubmit={() => setTimeout(refresh, 50)}
        >
          <label className="settings-field">
            <span>Name</span>
            <input type="text" name="label" placeholder="e.g. Landing" required maxLength={80} />
          </label>
          <label className="settings-field">
            <span>Id (optional)</span>
            <input
              type="text"
              name="id"
              placeholder={`auto: ${activeSkinId}-…`}
              maxLength={64}
            />
          </label>
          <label className="settings-field">
            <span>From outline</span>
            <select
              name="sourceId"
              value={createSourceId}
              onChange={(e) => setCreateSourceId(e.target.value)}
              required
            >
              {sourceOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                  {o.isSkinBase ? ' (Base)' : ''}
                  {o.inheritFrom ? ' · child' : ''}
                </option>
              ))}
            </select>
          </label>
          <label
            className="settings-field"
            title={
              createMode === 'inherit'
                ? 'Live child — source sections/styles stay shared'
                : 'Standalone snapshot of the source’s resolved layout'
            }
          >
            <span>Source</span>
            <select
              name="createMode"
              value={createMode}
              onChange={(e) => setCreateMode(e.target.value === 'copy' ? 'copy' : 'inherit')}
            >
              <option value="inherit">Inherit</option>
              <option value="copy">Copy</option>
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
      <Feedback state={inheritState} />

      <div className="outlines-table-wrap">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Id</th>
              <th scope="col">Parent</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {outlines.map((outline) => (
              <tr key={outline.id}>
                <td>
                  <strong>{outline.label}</strong>
                  {outline.isSkinBase ? (
                    <span className="outlines-badge" title="Skin Base shell — children inherit this">
                      Base
                    </span>
                  ) : null}
                  {outline.isCoreDefault && !outline.isSkinBase ? (
                    <span className="outlines-badge" title="Core bootstrap fallback">
                      Core
                    </span>
                  ) : null}
                  {outline.inheritFrom && !outline.isSkinBase ? (
                    <span className="outlines-badge" title={`inheritFrom ${outline.inheritFrom}`}>
                      Child
                    </span>
                  ) : null}
                  {outline.skinOwned ? (
                    <span className="outlines-badge" title={outline.skinId || activeSkinId}>
                      Skin
                    </span>
                  ) : outline.skinId ? (
                    <span className="outlines-badge" title={`Skin ${outline.skinId}`}>
                      Skin pack
                    </span>
                  ) : null}
                </td>
                <td>
                  <code>{outline.id}</code>
                </td>
                <td>
                  {outline.isSkinBase || outline.isCoreDefault ? (
                    <span className="outlines-muted">—</span>
                  ) : (
                    <form
                      action={inheritAction}
                      className="outlines-inherit-form"
                      onSubmit={() => setTimeout(refresh, 50)}
                    >
                      <input type="hidden" name="layoutId" value={outline.id} />
                      <select
                        name="inheritFromId"
                        className="gantry-inline-input"
                        defaultValue={outline.inheritFrom ?? baseOutlineId ?? ''}
                        disabled={inheritPending}
                        aria-label={`Parent outline for ${outline.label}`}
                        onChange={(e) => {
                          e.currentTarget.form?.requestSubmit()
                        }}
                      >
                        <option value="">None (standalone)</option>
                        {parentOptions
                          .filter((o) => o.id !== outline.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                              {o.isSkinBase ? ' (Base)' : ''}
                            </option>
                          ))}
                      </select>
                    </form>
                  )}
                </td>
                <td className="outlines-muted">{formatUpdated(outline.updatedAt)}</td>
                <td>
                  <div className="outlines-actions">
                    <Link
                      className="button-link"
                      href={`/admin/layouts?outline=${encodeURIComponent(outline.id)}`}
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
                    {outline.isCoreDefault || outline.isSkinBase ? null : (
                      <form
                        action={deleteAction}
                        onSubmit={(e) => {
                          if (
                            !window.confirm(
                              `Delete outline “${outline.label}” (${outline.id})? Pages still assigned to it will fall back to Base.`,
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
                        defaultValue={`${outline.label.replace(/\s*—\s*Base$/i, '').trim()} child`}
                        required
                        maxLength={80}
                        aria-label="Duplicate outline name"
                      />
                      <label className="settings-field">
                        <span>Source</span>
                        <select name="asInheritingChild" defaultValue="1" title="Inherit = live child; Copy = resolved snapshot">
                          <option value="1">Inherit</option>
                          <option value="0">Copy</option>
                        </select>
                      </label>
                      <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={dupPending}>
                        {dupPending ? 'Creating…' : 'Create'}
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
