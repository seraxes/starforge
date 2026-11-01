'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  createUserGroupAction,
  deleteUserGroupAction,
  renameUserGroupAction,
  type AclActionState,
} from '@/core/acl/actions'

type GroupRow = {
  id: string
  label: string
  description: string | null
  memberCount: number
  updatedAt: string
}

type Props = {
  groups: GroupRow[]
}

const initial: AclActionState = {}

function Feedback({ state }: { state: AclActionState }) {
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

export function GroupsManager({ groups }: Props) {
  const router = useRouter()
  const [createState, createAction, createPending] = useActionState(
    createUserGroupAction,
    initial,
  )
  const [renameState, renameAction, renamePending] = useActionState(
    renameUserGroupAction,
    initial,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteUserGroupAction,
    initial,
  )
  const [renamingId, setRenamingId] = useState<string | null>(null)

  useEffect(() => {
    if (createState.ok && createState.groupId) {
      router.push(`/app/admin/users/groups/${encodeURIComponent(createState.groupId)}`)
    } else if (createState.ok || renameState.ok || deleteState.ok) {
      router.refresh()
    }
  }, [createState, renameState, deleteState, router])

  return (
    <div className="groups-manager">
      <section className="outlines-create" aria-label="Create user group">
        <h3>Create group</h3>
        <form action={createAction} className="outlines-create-form">
          <label className="settings-field">
            <span>Name</span>
            <input type="text" name="label" placeholder="e.g. Moderators" required maxLength={80} />
          </label>
          <label className="settings-field">
            <span>Id (optional)</span>
            <input type="text" name="id" placeholder="auto from name" maxLength={64} />
          </label>
          <label className="settings-field">
            <span>Description</span>
            <input type="text" name="description" placeholder="Optional" maxLength={200} />
          </label>
          <label className="outlines-check">
            <input type="checkbox" name="openAfter" value="1" defaultChecked />
            <span>Open members after create</span>
          </label>
          <button type="submit" disabled={createPending}>
            {createPending ? 'Creating…' : 'Create'}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={renameState} />
      <Feedback state={deleteState} />

      <div className="outlines-table-wrap">
        <table className="outlines-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Id</th>
              <th scope="col">Members</th>
              <th scope="col">Updated</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr>
                <td colSpan={5} className="outlines-muted">
                  No groups yet — create one above (seed adds Staff / Editors on first visit).
                </td>
              </tr>
            ) : (
              groups.map((group) => (
                <tr key={group.id}>
                  <td>
                    <Link href={`/app/admin/users/groups/${encodeURIComponent(group.id)}`}>
                      {group.label}
                    </Link>
                    {group.description ? (
                      <p className="settings-hint" style={{ margin: '0.25rem 0 0' }}>
                        {group.description}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <code>{group.id}</code>
                  </td>
                  <td>{group.memberCount}</td>
                  <td>{formatUpdated(group.updatedAt)}</td>
                  <td className="outlines-actions">
                    {renamingId === group.id ? (
                      <form
                        action={renameAction}
                        className="admin-inline-form"
                        onSubmit={() => setTimeout(() => setRenamingId(null), 50)}
                      >
                        <input type="hidden" name="groupId" value={group.id} />
                        <input
                          type="text"
                          name="label"
                          defaultValue={group.label}
                          required
                          maxLength={80}
                          aria-label={`Rename ${group.id}`}
                        />
                        <input
                          type="text"
                          name="description"
                          defaultValue={group.description ?? ''}
                          placeholder="Description"
                          maxLength={200}
                          aria-label={`Description for ${group.id}`}
                        />
                        <button type="submit" disabled={renamePending}>
                          Save
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setRenamingId(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => setRenamingId(group.id)}
                        >
                          Rename
                        </button>
                        <Link
                          className="secondary"
                          href={`/app/admin/users/groups/${encodeURIComponent(group.id)}`}
                        >
                          Members
                        </Link>
                        <form action={deleteAction} className="admin-inline-form">
                          <input type="hidden" name="groupId" value={group.id} />
                          <button
                            type="submit"
                            className="secondary"
                            disabled={deletePending}
                            onClick={(e) => {
                              if (
                                !window.confirm(
                                  `Delete group “${group.label}”? Members and ACL rows are removed. Nav items using group:${group.id} will hide until reassigned.`,
                                )
                              ) {
                                e.preventDefault()
                              }
                            }}
                          >
                            Delete
                          </button>
                        </form>
                      </>
                    )}
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
