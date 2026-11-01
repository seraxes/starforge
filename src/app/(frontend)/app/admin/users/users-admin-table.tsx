'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'

import {
  setUserGroupsAction,
  type AclActionState,
  type UserGroupOption,
} from '@/core/acl'
import {
  setAppUserDisabledAction,
  setAppUserRoleAction,
  type AdminActionState,
} from '@/core/auth/admin-actions'
import {
  setAppUserCmsAccessAction,
  type CmsAccessActionState,
} from '@/core/cms-bridge/actions'
import type { AppRole } from '@/core/auth/permissions'

export type AdminUserRow = {
  id: string
  name: string
  email: string
  role: AppRole
  cmsAccess: boolean
  banned: boolean
  banReason: string | null
  createdAt: string
  groupIds: string[]
}

const initial: AdminActionState = {}
const cmsInitial: CmsAccessActionState = {}
const groupsInitial: AclActionState = {}

function RoleForm({ user }: { user: AdminUserRow }) {
  const [state, action, pending] = useActionState(setAppUserRoleAction, initial)
  // Prefer the role returned by the action so a successful save (and React's
  // post-action form reset) cannot snap the select back to a stale defaultValue.
  const committedRole = state.role ?? user.role
  const [role, setRole] = useState<AppRole>(committedRole)

  useEffect(() => {
    setRole(committedRole)
  }, [committedRole])

  return (
    <form action={action} className="admin-inline-form">
      <input type="hidden" name="userId" value={user.id} />
      <label className="sr-only" htmlFor={`role-${user.id}`}>
        Role for {user.email}
      </label>
      <select
        id={`role-${user.id}`}
        name="role"
        value={role}
        onChange={(event) => setRole(event.target.value as AppRole)}
        disabled={pending}
      >
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

function CmsAccessToggle({ user }: { user: AdminUserRow }) {
  const [state, action, pending] = useActionState(setAppUserCmsAccessAction, cmsInitial)
  const nextEnabled = !user.cmsAccess

  return (
    <form action={action} className="admin-inline-form cms-access-toggle">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="cmsAccess" value={nextEnabled ? 'true' : 'false'} />
      <label className="cms-switch" title={user.cmsAccess ? 'CMS access on' : 'CMS access off'}>
        <span className="sr-only">CMS access for {user.email}</span>
        <button
          type="submit"
          role="switch"
          aria-checked={user.cmsAccess}
          className={user.cmsAccess ? 'cms-switch-track is-on' : 'cms-switch-track'}
          disabled={pending}
        >
          <span className="cms-switch-thumb" />
        </button>
        <span className="cms-switch-label">{user.cmsAccess ? 'On' : 'Off'}</span>
      </label>
      {state.error ? <span className="admin-inline-error">{state.error}</span> : null}
      {state.ok ? <span className="admin-inline-ok">Updated</span> : null}
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

function GroupsForm({
  user,
  groupOptions,
}: {
  user: AdminUserRow
  groupOptions: UserGroupOption[]
}) {
  const [state, action, pending] = useActionState(setUserGroupsAction, groupsInitial)

  if (groupOptions.length === 0) {
    return (
      <span className="settings-hint">
        <Link href="/app/admin/users/groups">Create groups</Link>
      </span>
    )
  }

  return (
    <form action={action} className="admin-inline-form admin-groups-form">
      <input type="hidden" name="userId" value={user.id} />
      <fieldset className="admin-groups-fieldset">
        <legend className="sr-only">Groups for {user.email}</legend>
        {groupOptions.map((g) => (
          <label key={g.id} className="outlines-check">
            <input
              type="checkbox"
              name="groupId"
              value={g.id}
              defaultChecked={user.groupIds.includes(g.id)}
            />
            <span>{g.label}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Save groups'}
      </button>
      {state.error ? <span className="admin-inline-error">{state.error}</span> : null}
      {state.ok ? <span className="admin-inline-ok">Saved</span> : null}
    </form>
  )
}

export function UsersAdminTable({
  users,
  groupOptions,
}: {
  users: AdminUserRow[]
  groupOptions: UserGroupOption[]
}) {
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
            <th scope="col">Groups</th>
            <th scope="col">CMS access</th>
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
                <GroupsForm user={user} groupOptions={groupOptions} />
              </td>
              <td>
                <CmsAccessToggle user={user} />
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
