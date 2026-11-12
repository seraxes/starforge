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
  parentId: string | null
  depth: number
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

/** Stable SSR/CSR stamp (avoid toLocaleString hydration mismatch). */
function formatUpdated(iso: string) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—'
    return d.toISOString().replace('T', ' ').slice(0, 16)
  } catch {
    return '—'
  }
}

function ParentSelect({
  groups,
  excludeId,
  defaultValue,
  name = 'parentId',
}: {
  groups: GroupRow[]
  excludeId?: string
  defaultValue?: string | null
  name?: string
}) {
  const options = excludeId
    ? groups.filter((g) => g.id !== excludeId)
    : groups
  return (
    <label className="settings-field">
      <span>Parent</span>
      <select name={name} defaultValue={defaultValue ?? ''}>
        <option value="">None (root)</option>
        {options.map((g) => (
          <option key={g.id} value={g.id}>
            {g.depth > 0 ? `${'—'.repeat(g.depth)} ${g.label}` : g.label}
          </option>
        ))}
      </select>
    </label>
  )
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
      router.push(`/admin/users/groups/${encodeURIComponent(createState.groupId)}`)
    } else if (createState.ok || renameState.ok || deleteState.ok) {
      router.refresh()
    }
  }, [createState, renameState, deleteState, router])

  return (
    <div className="groups-manager admin-settings-mosaic">
      <section className="outlines-create" aria-label="Create user group">
        <h3>Create group</h3>
        <form action={createAction} className="outlines-create-form admin-create-form">
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
          <ParentSelect groups={groups} />
          <label className="outlines-check">
            <input type="checkbox" name="openAfter" value="1" defaultChecked />
            <span>Open members after create</span>
          </label>
          <button type="submit" className="gantry-toolbar-btn gantry-toolbar-btn-save" disabled={createPending}>
            {createPending ? 'Creating…' : 'Create'}
          </button>
        </form>
        <Feedback state={createState} />
      </section>

      <Feedback state={renameState} />
      <Feedback state={deleteState} />

      <div className="outlines-table-wrap admin-settings-panel-wide">
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
                    <span style={group.depth > 0 ? { paddingLeft: `${group.depth * 1.25}rem` } : undefined}>
                      {group.depth > 0 ? (
                        <span className="outlines-muted" aria-hidden>
                          —{' '}
                        </span>
                      ) : null}
                      <Link href={`/admin/users/groups/${encodeURIComponent(group.id)}`}>
                        {group.label}
                      </Link>
                    </span>
                    {group.parentId ? (
                      <p className="settings-hint" style={{ margin: '0.25rem 0 0' }}>
                        Parent: <code>{group.parentId}</code>
                      </p>
                    ) : null}
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
                          autoFocus
                        />
                        <input
                          type="text"
                          name="description"
                          defaultValue={group.description ?? ''}
                          placeholder="Description"
                          maxLength={200}
                          aria-label={`Description for ${group.id}`}
                        />
                        <ParentSelect
                          groups={groups}
                          excludeId={group.id}
                          defaultValue={group.parentId}
                        />
                        <button
                          type="submit"
                          className="gantry-toolbar-btn gantry-toolbar-btn-save"
                          disabled={renamePending}
                        >
                          {renamePending ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          className="gantry-toolbar-btn gantry-toolbar-btn-quiet"
                          onClick={() => setRenamingId(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="gantry-toolbar-btn secondary"
                          onClick={() => setRenamingId(group.id)}
                        >
                          Rename
                        </button>
                        {/* Name already opens members — no redundant Members band. */}
                        <form action={deleteAction} className="admin-inline-form">
                          <input type="hidden" name="groupId" value={group.id} />
                          <button
                            type="submit"
                            className="gantry-toolbar-btn gantry-toolbar-btn-danger danger"
                            disabled={deletePending}
                            onClick={(e) => {
                              if (
                                !window.confirm(
                                  `Delete group “${group.label}”? Members and ACL rows are removed. Nested child groups must be reparented or deleted first. Navigation items using group:${group.id} will hide until reassigned.`,
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
