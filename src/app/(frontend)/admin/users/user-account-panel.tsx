'use client'

import React, { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  setUserGroupsAction,
  type AclActionState,
} from '@/core/acl/actions'
import type { UserGroupOption } from '@/core/acl/types'
import {
  setAppUserDisabledAction,
  setAppUserRoleAction,
  updateAppUserIdentityAction,
  type AdminActionState,
} from '@/core/auth/admin-actions'
import type { AppRole } from '@/core/auth/permissions'
import {
  setAppUserCmsAccessAction,
  type CmsAccessActionState,
} from '@/core/cms-bridge/actions'

import { useAdminToast } from '../admin-toast'

export type UserAccountModel = {
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

export function UserAccountPanel({
  user,
  groupOptions,
}: {
  user: UserAccountModel
  groupOptions: UserGroupOption[]
}) {
  const [identityState, identityAction, identityPending] = useActionState(
    updateAppUserIdentityAction,
    initial,
  )
  const [roleState, roleAction, rolePending] = useActionState(setAppUserRoleAction, initial)
  const [cmsState, cmsAction, cmsPending] = useActionState(setAppUserCmsAccessAction, cmsInitial)
  const [disableState, disableAction, disablePending] = useActionState(
    setAppUserDisabledAction,
    initial,
  )
  const [groupsState, groupsAction, groupsPending] = useActionState(
    setUserGroupsAction,
    groupsInitial,
  )
  const router = useRouter()
  const { notifySaved, notifyError } = useAdminToast()

  const committedRole = roleState.role ?? user.role
  const [role, setRole] = useState<AppRole>(committedRole)

  useEffect(() => {
    setRole(committedRole)
  }, [committedRole])

  useEffect(() => {
    let saved = false
    for (const state of [identityState, roleState, cmsState, disableState, groupsState]) {
      if (state.ok) {
        notifySaved('Saved')
        saved = true
      } else if (state.error) notifyError(state.error)
    }
    if (saved) router.refresh()
  }, [
    identityState,
    roleState,
    cmsState,
    disableState,
    groupsState,
    notifySaved,
    notifyError,
    router,
  ])

  const busy =
    identityPending || rolePending || cmsPending || disablePending || groupsPending
  const nextCms = !user.cmsAccess
  const nextDisabled = !user.banned

  return (
    <div className="admin-settings-mosaic">
      <fieldset className="settings-fieldset">
        <legend>Identity</legend>
        <form action={identityAction} className="sf-events-manager">
          <input type="hidden" name="userId" value={user.id} />
          <label className="settings-field">
            <span>Real name</span>
            <input
              type="text"
              name="name"
              required
              maxLength={100}
              defaultValue={user.name}
              disabled={busy}
              autoComplete="name"
            />
          </label>
          <label className="settings-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              required
              maxLength={254}
              defaultValue={user.email}
              disabled={busy}
              autoComplete="email"
            />
          </label>
          <p className="settings-hint">
            Sign-in email for this account. Changing it clears email verification.
          </p>
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={busy}
            >
              {identityPending ? 'Saving…' : 'Save identity'}
            </button>
          </div>
        </form>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Access</legend>
        <form action={roleAction} className="settings-field">
          <input type="hidden" name="userId" value={user.id} />
          <span>Role</span>
          <select
            name="role"
            value={role}
            disabled={busy}
            onChange={(e) => {
              setRole(e.target.value as AppRole)
              e.currentTarget.form?.requestSubmit()
            }}
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </form>

        <form action={cmsAction} className="settings-field">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="cmsAccess" value={nextCms ? 'true' : 'false'} />
          <span>CMS access</span>
          <button
            type="submit"
            role="switch"
            aria-checked={user.cmsAccess}
            className={user.cmsAccess ? 'cms-switch-track is-on' : 'cms-switch-track'}
            disabled={busy}
          >
            <span className="cms-switch-thumb" />
          </button>
          <span className={user.cmsAccess ? 'cms-switch-label is-on' : 'cms-switch-label is-off'}>
            {user.cmsAccess ? 'On' : 'Off'}
          </span>
        </form>

        <form action={groupsAction}>
          <input type="hidden" name="userId" value={user.id} />
          <fieldset className="admin-groups-fieldset">
            <legend>Groups</legend>
            {groupOptions.length === 0 ? (
              <p className="settings-hint">
                <Link href="/admin/users/groups">Create groups</Link>
              </p>
            ) : (
              groupOptions.map((g) => (
                <label key={g.id} className="outlines-check">
                  <input
                    type="checkbox"
                    name="groupId"
                    value={g.id}
                    defaultChecked={user.groupIds.includes(g.id)}
                    disabled={busy}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  />
                  <span>{g.label}</span>
                </label>
              ))
            )}
          </fieldset>
        </form>
      </fieldset>

      <fieldset className="settings-fieldset">
        <legend>Status</legend>
        <p>
          {user.banned ? (
            <span className="admin-badge admin-badge-warn" title={user.banReason ?? undefined}>
              Disabled
            </span>
          ) : (
            <span className="admin-badge">Active</span>
          )}{' '}
          <span className="layout-muted">
            · created{' '}
            <time dateTime={user.createdAt}>
              {new Date(user.createdAt).toLocaleDateString('hu-HU')}
            </time>
          </span>
        </p>
        <form action={disableAction} className="page-settings-actions">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="disabled" value={nextDisabled ? 'true' : 'false'} />
          {nextDisabled ? (
            <input type="hidden" name="reason" value="Disabled by admin" />
          ) : null}
          <button
            type="submit"
            className={
              nextDisabled
                ? 'gantry-toolbar-btn gantry-toolbar-btn-disable'
                : 'gantry-toolbar-btn gantry-toolbar-btn-enable'
            }
            disabled={busy}
          >
            {disablePending ? 'Updating…' : nextDisabled ? 'Disable account' : 'Enable account'}
          </button>
        </form>
      </fieldset>
    </div>
  )
}
