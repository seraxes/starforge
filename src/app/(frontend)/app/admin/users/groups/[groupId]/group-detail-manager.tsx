'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import {
  addGroupMemberAction,
  removeGroupMemberAction,
  type AclActionState,
} from '@/core/acl/actions'
import type { AppRole } from '@/core/auth/permissions'

type MemberRow = {
  userId: string
  name: string
  email: string
  role: AppRole
  joinedAt: string
}

type Candidate = {
  id: string
  name: string
  email: string
  role: AppRole
}

type Props = {
  groupId: string
  groupLabel: string
  members: MemberRow[]
  candidates: Candidate[]
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

export function GroupDetailManager({
  groupId,
  groupLabel,
  members,
  candidates,
}: Props) {
  const router = useRouter()
  const [addState, addAction, addPending] = useActionState(addGroupMemberAction, initial)
  const [removeState, removeAction, removePending] = useActionState(
    removeGroupMemberAction,
    initial,
  )

  useEffect(() => {
    if (addState.ok || removeState.ok) {
      router.refresh()
    }
  }, [addState, removeState, router])

  return (
    <div className="group-detail-manager">
      <section className="outlines-create" aria-label={`Members of ${groupLabel}`}>
        <h3>Members</h3>
        <Feedback state={addState} />
        <Feedback state={removeState} />

        {candidates.length > 0 ? (
          <form action={addAction} className="outlines-create-form">
            <input type="hidden" name="groupId" value={groupId} />
            <label className="settings-field">
              <span>Add user</span>
              <select name="userId" required defaultValue="">
                <option value="" disabled>
                  Select account…
                </option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email}) — {u.role}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={addPending}>
              {addPending ? 'Adding…' : 'Add member'}
            </button>
          </form>
        ) : (
          <p className="settings-hint">All accounts are already in this group (or none exist).</p>
        )}

        <div className="outlines-table-wrap">
          <table className="outlines-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Joined</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="outlines-muted">
                    No members yet.
                  </td>
                </tr>
              ) : (
                members.map((m) => (
                  <tr key={m.userId}>
                    <td>{m.name}</td>
                    <td>
                      <code>{m.email}</code>
                    </td>
                    <td>{m.role}</td>
                    <td>
                      <time dateTime={m.joinedAt}>
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </time>
                    </td>
                    <td>
                      <form action={removeAction} className="admin-inline-form">
                        <input type="hidden" name="groupId" value={groupId} />
                        <input type="hidden" name="userId" value={m.userId} />
                        <button type="submit" className="secondary" disabled={removePending}>
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
