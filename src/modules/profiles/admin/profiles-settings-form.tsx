'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import { saveProfilesSettingsAction, type ProfilesActionState } from '../actions'
import {
  PROFILE_FIELD_GROUPS,
  PROFILE_FIELDS,
  VISIBILITY_LABELS,
  VISIBILITY_SCOPES,
  isVisibilityConfigurable,
} from '../fields'
import { effectiveVisibility } from '../privacy'
import type { ProfilesModuleSettings } from '../types'

const initial: ProfilesActionState = {}

export function ProfilesSettingsForm({ settings }: { settings: ProfilesModuleSettings }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(saveProfilesSettingsAction, initial)
  useNotifySavedOnOk(state)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="admin-settings-mosaic sf-profiles-settings">
      <section className="page-settings-panel">
        <header className="page-settings-panel-head">
          <h3>Accounts &amp; pages</h3>
        </header>
        <div className="page-settings-panel-body">
          <label className="settings-field">
            <span>Username change cooldown (days)</span>
            <input
              type="number"
              name="handleChangeCooldownDays"
              min={0}
              max={365}
              defaultValue={settings.handleChangeCooldownDays}
              disabled={pending}
            />
            <span className="settings-hint">
              0 = members can rename any time. The first change after sign-up is always free.
              Admin edits ignore the cooldown.
            </span>
          </label>
          <label className="settings-field">
            <span>Who can open profile pages</span>
            <select
              name="profilePagesVisibility"
              defaultValue={settings.profilePagesVisibility}
              disabled={pending}
            >
              <option value="public">Everyone</option>
              <option value="registered">Signed-in members only</option>
            </select>
          </label>
          <label className="settings-field settings-flag">
            <input
              type="checkbox"
              name="memberUploadsEnabled"
              value="1"
              defaultChecked={settings.memberUploadsEnabled}
              disabled={pending}
            />
            <span>Members can upload their own avatar and cover image</span>
          </label>
          <label className="settings-field settings-flag">
            <input
              type="checkbox"
              name="allowFriendsScope"
              value="1"
              defaultChecked={settings.allowFriendsScope}
              disabled={pending}
            />
            <span>Offer “Friends only” visibility (turn on once Social is installed)</span>
          </label>
        </div>
      </section>

      <section className="page-settings-panel sf-profiles-fields-panel">
        <header className="page-settings-panel-head">
          <h3>Fields &amp; privacy defaults</h3>
        </header>
        <div className="page-settings-panel-body">
          <p className="settings-hint">
            Display name, username and avatar are always on and always public. For the rest:
            switch a field off for the whole site, make it required, and choose who sees it by
            default — members can still tighten (or loosen) their own.
          </p>
          <div className="outlines-table-wrap">
            <table className="outlines-table sf-profiles-fields-table">
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">On</th>
                  <th scope="col">Required</th>
                  <th scope="col">Default visibility</th>
                </tr>
              </thead>
              <tbody>
                {PROFILE_FIELD_GROUPS.map((group) => {
                  const defs = PROFILE_FIELDS.filter((f) => f.group === group.key && !f.locked)
                  if (defs.length === 0) return null
                  return (
                    <React.Fragment key={group.key}>
                      <tr className="sf-profiles-fields-group">
                        <th colSpan={4} scope="colgroup">
                          {group.label}
                        </th>
                      </tr>
                      {defs.map((def) => (
                        <tr key={def.key}>
                          <td>{def.label}</td>
                          <td>
                            <input
                              type="checkbox"
                              name={`enabled:${def.key}`}
                              value="1"
                              defaultChecked={!settings.disabledFields.includes(def.key)}
                              disabled={pending}
                              aria-label={`${def.label} enabled`}
                            />
                          </td>
                          <td>
                            <input
                              type="checkbox"
                              name={`required:${def.key}`}
                              value="1"
                              defaultChecked={settings.requiredFields.includes(def.key)}
                              disabled={pending || Boolean(def.selfOnly)}
                              aria-label={`${def.label} required`}
                            />
                          </td>
                          <td>
                            {isVisibilityConfigurable(def.key) ? (
                              <select
                                name={`vis:${def.key}`}
                                defaultValue={effectiveVisibility(def.key, {}, settings)}
                                disabled={pending}
                                aria-label={`${def.label} default visibility`}
                              >
                                {VISIBILITY_SCOPES.filter(
                                  (s) => s !== 'friends' || settings.allowFriendsScope,
                                ).map((s) => (
                                  <option key={s} value={s}>
                                    {VISIBILITY_LABELS[s]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="layout-muted">Only me (always)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="page-settings-actions">
            <button
              type="submit"
              className="gantry-toolbar-btn gantry-toolbar-btn-save"
              disabled={pending}
            >
              {pending ? 'Saving…' : 'Save settings'}
            </button>
          </div>
          {state.error ? (
            <p className="admin-inline-error" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok && state.message ? (
            <p className="admin-inline-ok" role="status">
              {state.message}
            </p>
          ) : null}
        </div>
      </section>
    </form>
  )
}
