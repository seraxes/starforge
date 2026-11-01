'use client'

import React, { useActionState, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createNavMenuAction,
  deleteNavMenuAction,
  duplicateNavMenuAction,
  renameNavMenuAction,
  type NavActionState,
} from '@/core/nav/actions'

type MenuRow = {
  id: string
  label: string
  updatedAt: string
  itemCount: number
  isDefault: boolean
  isSitePrimary: boolean
}

type Props = {
  menus: MenuRow[]
  primaryNavMenuId: string
}

const initial: NavActionState = {}

function Feedback({ state }: { state: NavActionState }) {
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

export function NavMenusManager({ menus, primaryNavMenuId }: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(createNavMenuAction, initial)
  const [renameState, renameAction, renamePending] = useActionState(renameNavMenuAction, initial)
  const [dupState, dupAction, dupPending] = useActionState(duplicateNavMenuAction, initial)
  const [deleteState, deleteAction, deletePending] = useActionState(deleteNavMenuAction, initial)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const refresh = () => router.refresh()

  return (
    <div className="nav-menus-manager">
      <section className="outlines-create" aria-label="Create navigation set">
        <h3>Create menu</h3>
        <form
          action={createAction}
          className="outlines-create-form"
          onSubmit={() => setTimeout(refresh, 50)}
        >
          <label className="settings-field">
            <span>Name</span>
            <input type="text" name="label" placeholder="e.g. Footer" required maxLength={80} />
          </label>
          <label className="settings-field">
            <span>Id (optional)</span>
            <input type="text" name="id" placeholder="auto from name" maxLength={64} />
          </label>
          <label className="settings-field">
            <span>Copy from</span>
            <select name="copyFromId" defaultValue="">
              <option value="">Empty menu</option>
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} ({m.id})
                </option>
              ))}
            </select>
          </label>
          <label className="outlines-check">
            <input type="checkbox" name="openAfter" value="1" defaultChecked />
            <span>Open items editor after create</span>
          </label>
          <button type="submit" disabled={createPending}>
            {createPending ? 'Creating…' : 'Create'}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={renameState} />
      <Feedback state={dupState} />
      <Feedback state={deleteState} />

      <p className="settings-hint">
        Site primary menu: <code>{primaryNavMenuId}</code> (change under{' '}
        <Link href="/app/admin/settings">Site settings</Link>).
      </p>

      <div className="outlines-table-wrap">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Id</th>
              <th scope="col">Items</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {menus.length === 0 ? (
              <tr>
                <td colSpan={5} className="outlines-muted">
                  No menus yet — create Main via seed or the form above.
                </td>
              </tr>
            ) : (
              menus.map((menu) => (
                <tr key={menu.id}>
                  <td>
                    <Link href={`/app/admin/nav/${encodeURIComponent(menu.id)}`}>
                      {menu.label}
                    </Link>
                    {menu.isDefault ? (
                      <span className="outlines-badge">Default</span>
                    ) : null}
                    {menu.isSitePrimary ? (
                      <span className="outlines-badge">Site primary</span>
                    ) : null}
                  </td>
                  <td>
                    <code>{menu.id}</code>
                  </td>
                  <td>{menu.itemCount}</td>
                  <td>{formatUpdated(menu.updatedAt)}</td>
                  <td>
                    <div className="outlines-actions">
                      <Link
                        className="secondary"
                        href={`/app/admin/nav/${encodeURIComponent(menu.id)}`}
                      >
                        Edit items
                      </Link>
                      {renamingId === menu.id ? (
                        <form
                          action={renameAction}
                          className="outlines-inline-form"
                          onSubmit={() => {
                            setRenamingId(null)
                            setTimeout(refresh, 50)
                          }}
                        >
                          <input type="hidden" name="id" value={menu.id} />
                          <input
                            type="text"
                            name="label"
                            defaultValue={menu.label}
                            required
                            maxLength={80}
                          />
                          <button type="submit" disabled={renamePending}>
                            Save
                          </button>
                          <button type="button" className="secondary" onClick={() => setRenamingId(null)}>
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setRenamingId(menu.id)}
                        >
                          Rename
                        </button>
                      )}
                      {duplicatingId === menu.id ? (
                        <form
                          action={dupAction}
                          className="outlines-inline-form"
                          onSubmit={() => {
                            setDuplicatingId(null)
                            setTimeout(refresh, 50)
                          }}
                        >
                          <input type="hidden" name="id" value={menu.id} />
                          <input
                            type="text"
                            name="label"
                            defaultValue={`${menu.label} copy`}
                            required
                            maxLength={80}
                          />
                          <button type="submit" disabled={dupPending}>
                            Duplicate
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => setDuplicatingId(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setDuplicatingId(menu.id)}
                        >
                          Duplicate
                        </button>
                      )}
                      {!menu.isDefault ? (
                        <form
                          action={deleteAction}
                          onSubmit={(e) => {
                            if (!confirm(`Delete menu “${menu.label}”?`)) e.preventDefault()
                            else setTimeout(refresh, 50)
                          }}
                        >
                          <input type="hidden" name="id" value={menu.id} />
                          <button type="submit" className="danger" disabled={deletePending}>
                            Delete
                          </button>
                        </form>
                      ) : null}
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
