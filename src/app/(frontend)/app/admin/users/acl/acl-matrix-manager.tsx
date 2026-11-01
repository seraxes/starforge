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
  allowed: string[]
}

type Props = {
  resources: ResourceOpt[]
  groups: GroupCol[]
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
    <div className="acl-page">
      <section className="outlines-create" aria-label="Group permissions matrix">
        <h3>Permissions by group</h3>
        <p className="settings-hint">
          Check a cell to grant that admin area to the group. Viewing (menus / modules) is tagged
          on each Nav item or layout particle — not here. Saves automatically into{' '}
          <code>sf_acl_permissions</code>.
        </p>
        <Feedback state={state} />

        {groups.length === 0 ? (
          <p className="admin-empty">
            No groups yet — <Link href="/app/admin/users/groups">create a group</Link> first.
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
                      {groups.map((g) => (
                        <td key={`${g.id}-${res.key}`}>
                          <label className="outlines-check">
                            <input
                              type="checkbox"
                              name="grant"
                              value={`${g.id}::${res.key}`}
                              defaultChecked={g.allowed.includes(res.key)}
                              disabled={pending}
                              onChange={saveNow}
                            />
                            <span className="sr-only">
                              Allow {res.label} for {g.label}
                            </span>
                          </label>
                        </td>
                      ))}
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
