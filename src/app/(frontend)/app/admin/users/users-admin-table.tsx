'use client'

import React, { useActionState } from 'react'
import Link from 'next/link'

import {
  setAppUserDisabledAction,
  setAppUserRoleAction,
  type AdminActionState,
} from '@/core/auth/admin-actions'
import type { AppRole } from '@/core/auth/permissions'

export type AdminUserRow = {
  id: string
  name: string
  email: string
  role: AppRole
  banned: boolean
  banReason: string | null
  createdAt: string
}

const initial: AdminActionState = {}

function RoleForm({ user }: { user: AdminUserRow }) {
  const [state, action, pending] = useActionState(setAppUserRoleAction, initial)

  return (
    <form action={action} className="admin-inline-form">
      <input type="hidden" name="userId" value={user.id} />
      <label className="sr-only" htmlFor={`role-${user.id}`}>
        Role for {user.email}
      </label>
      <select id={`role-${user.id}`} name="role" defaultValue={user.role} disabled={pending}>
        <option value="member">member</option>
        <option value="admin">admin</option>
      </select>
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Set role'}
      </button>
      {state.error ? <span className="admin-inline-error">{state.error}</span> : null}
      {state.ok ? <span className="admin-inline-ok">Saved</span> : null}
    </form>
  )
}

function DisableForm({ user }: { user: AdminUserRow }) {
  const [state, action, pending] = useActionState(setAppUserDisabledAction, initial)
  const nextDisabled = !user.banned

  return (
    <form action={action} className="admin-inline-form">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="disabled" value={nextDisabled ? 'true' : 'false'} />
      {nextDisabled ? (
        <input type="hidden" name="reason" value="Disabled by admin" />
      ) : null}
      <button type="submit" className={nextDisabled ? 'secondary' : 'primary'} disabled={pending}>
        {pending ? 'Updating…' : nextDisabled ? 'Disable' : 'Enable'}
      </button>
      {state.error ? <span className="admin-inline-error">{state.error}</span> : null}
      {state.ok ? <span className="admin-inline-ok">Updated</span> : null}
    </form>
  )
}

export function UsersAdminTable({ users }: { users: AdminUserRow[] }) {
  if (users.length === 0) {
    return (
      <p className="admin-empty">
        No app users yet. Register at <Link href="/register">/register</Link>, run{' '}
        <code>npm run seed</code>, or set <code>STARFORGE_ADMIN_EMAILS</code> then register that
        email.
      </p>
    )
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} data-banned={user.banned ? 'true' : 'false'}>
              <td>{user.name}</td>
              <td>
                <code>{user.email}</code>
              </td>
              <td>
                <RoleForm user={user} />
              </td>
              <td>
                {user.banned ? (
                  <span className="admin-badge admin-badge-warn" title={user.banReason ?? undefined}>
                    Disabled
                  </span>
                ) : (
                  <span className="admin-badge">Active</span>
                )}
              </td>
              <td>
                <time dateTime={user.createdAt}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </time>
              </td>
              <td>
                <DisableForm user={user} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
