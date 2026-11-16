'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import {
  saveAllGroupsAclMatrixAction,
  type AclActionState,
} from '@/core/acl/actions'

import { useNotifySavedOnOk } from '../../admin-toast'
import { useAutosaveForm } from '../../use-autosave-form'

type ResourceOpt = { key: string; label: string }

type GroupCol = {
  id: string
  label: string
  levels: Record<string, string>
}

type Props = {
  resources: ResourceOpt[]
  groups: GroupCol[]
}

const initial: AclActionState = {}

const LEVELS = [
  { value: '', label: '—' },
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'manage', label: 'Manage' },
] as const

function Feedback({ state }: { state: AclActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  return null
}

export function AclMatrixManager({ resources, groups }: Props) {
  const router = useRouter()
  const [state, action, pending] = useActionState(saveAllGroupsAclMatrixAction, initial)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, saveNow } = useAutosaveForm()

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <div className="acl-page admin-settings-mosaic">
      <section className="outlines-create admin-settings-panel-wide" aria-label="Group permissions matrix">
        <h3>Permissions by group</h3>
        <p className="settings-hint">
          Each cell is a level. <strong>View</strong> opens the area. <strong>Edit</strong> creates
          and updates. <strong>Manage</strong> includes edit plus delete, settings, and money
          changes. A higher level includes the lower ones. If someone is in several groups, the
          highest level wins, including parent groups. App admins bypass this matrix. Role changes,
          this matrix, and the environment file stay app-admin. Saves automatically into{' '}
          <code>sf_acl_permissions</code>.
        </p>
        <Feedback state={state} />

        {groups.length === 0 ? (
          <p className="admin-empty">
            No groups yet — <Link href="/admin/users/groups">create a group</Link> first.
          </p>
        ) : (
          <form ref={formRef} action={action} className="acl-matrix-form">
            {groups.map((g) => (
              <input key={g.id} type="hidden" name="matrixGroupId" value={g.id} />
            ))}
            <div className="outlines-table-wrap">
              <table className="outlines-table acl-matrix-table">
                <thead>
                  <tr>
                    <th scope="col">Resource</th>
                    {groups.map((g) => (
                      <th key={g.id} scope="col">
                        {g.label}
                        <div>
                          <code>{g.id}</code>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.map((res) => (
                    <tr key={res.key}>
                      <th scope="row">
                        {res.label}
                        <div>
                          <code>{res.key}</code>
                        </div>
                      </th>
                      {groups.map((g) => {
                        const current = g.levels[res.key] ?? ''
                        return (
                          <td key={`${g.id}-${res.key}`}>
                            <label className="sr-only" htmlFor={`acl-${g.id}-${res.key}`}>
                              {res.label} for {g.label}
                            </label>
                            <select
                              id={`acl-${g.id}-${res.key}`}
                              name="grant"
                              defaultValue={current ? `${g.id}::${res.key}::${current}` : ''}
                              disabled={pending}
                              onChange={saveNow}
                            >
                              {LEVELS.map((level) => (
                                <option
                                  key={level.value || 'none'}
                                  value={level.value ? `${g.id}::${res.key}::${level.value}` : ''}
                                >
                                  {level.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pending ? <p className="field-hint">Saving…</p> : null}
          </form>
        )}
      </section>
    </div>
  )
}
