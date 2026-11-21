'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  createSocialGroupCategoryAction,
  saveSocialGroupsSettingsAction,
  setSocialGroupVerifiedAction,
  type SocialModerationActionState,
  type SocialSettingsActionState,
} from '../actions'
import { GROUP_CATEGORY_KINDS } from '../groups'
import {
  SOCIAL_CREATOR_ROLES,
  SOCIAL_GROUP_JOIN_RULES,
  SOCIAL_MAX_GROUP_MEMBERS_MAX,
  SOCIAL_MAX_GROUP_MEMBERS_MIN,
  type SocialModuleSettings,
} from '../pack-settings'

type CategoryRow = {
  id: string
  name: string
  slug: string
  kind: string
}

type GroupRow = {
  id: string
  name: string
  slug: string
  ownerUserId: string
  categoryName: string
  verifiedAt: string
}

type Props = {
  settings: SocialModuleSettings
  categories: CategoryRow[]
  groups: GroupRow[]
}

const initialSettings: SocialSettingsActionState = {}
const initialModeration: SocialModerationActionState = {}

const CREATOR_LABEL: Record<(typeof SOCIAL_CREATOR_ROLES)[number], string> = {
  members: 'Members',
  staff: 'Staff only',
}

const JOIN_LABEL: Record<(typeof SOCIAL_GROUP_JOIN_RULES)[number], string> = {
  open: 'Open',
  closed: 'Closed',
}

const KIND_LABEL: Record<(typeof GROUP_CATEGORY_KINDS)[number], string> = {
  general: 'General',
  team: 'Team',
  association: 'Association',
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      className="gantry-toolbar-btn gantry-toolbar-btn-save"
      disabled={pending}
    >
      {pending ? 'Saving…' : 'Save settings'}
    </button>
  )
}

function CreateCategoryForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    createSocialGroupCategoryAction,
    initialModeration,
  )
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction}>
      <label className="settings-field">
        <span>Name</span>
        <input type="text" name="name" required disabled={pending} />
      </label>
      <label className="settings-field">
        <span>Slug</span>
        <input type="text" name="slug" disabled={pending} placeholder="optional" />
      </label>
      <label className="settings-field">
        <span>Kind</span>
        <select name="kind" defaultValue="general" disabled={pending} required>
          {GROUP_CATEGORY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABEL[kind]}
            </option>
          ))}
        </select>
      </label>
      <div className="page-settings-actions">
        <button type="submit" className="gantry-toolbar-btn" disabled={pending}>
          {pending ? 'Adding…' : 'Add category'}
        </button>
      </div>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="admin-inline-ok" role="status">
          Category added.
        </p>
      ) : null}
    </form>
  )
}

function VerifyGroupButton({ groupId, verified }: { groupId: string; verified: boolean }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    setSocialGroupVerifiedAction,
    initialModeration,
  )
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction}>
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="verified" value={verified ? '0' : '1'} />
      <button type="submit" className="gantry-toolbar-btn" disabled={pending}>
        {pending ? 'Updating…' : verified ? 'Clear verified' : 'Verify'}
      </button>
      {state.error ? <p className="admin-inline-error">{state.error}</p> : null}
    </form>
  )
}

export function SocialGroupsSettingsForm({ settings, categories, groups }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    saveSocialGroupsSettingsAction,
    initialSettings,
  )

  useNotifySavedOnOk(state)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <>
      <form action={formAction}>
        <div className="page-settings-actions" style={{ marginBottom: '1rem' }}>
          <SaveButton pending={pending} />
        </div>

        <div className="admin-settings-mosaic sf-social-settings">
          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Groups</h3>
            </header>
            <div className="page-settings-panel-body">
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowGroups"
                  value="1"
                  defaultChecked={settings.allowGroups}
                  disabled={pending}
                />
                <span>Groups on</span>
              </label>
              <label className="settings-field">
                <span>Who can create one</span>
                <select
                  name="groupWhoCanCreate"
                  defaultValue={settings.groupWhoCanCreate}
                  disabled={pending}
                >
                  {SOCIAL_CREATOR_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {CREATOR_LABEL[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="groupsNeedApproval"
                  value="1"
                  defaultChecked={settings.groupsNeedApproval}
                  disabled={pending}
                />
                <span>New groups need approval</span>
              </label>
              <label className="settings-field">
                <span>Default join rule</span>
                <select
                  name="defaultGroupJoinRule"
                  defaultValue={settings.defaultGroupJoinRule}
                  disabled={pending}
                >
                  {SOCIAL_GROUP_JOIN_RULES.map((rule) => (
                    <option key={rule} value={rule}>
                      {JOIN_LABEL[rule]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="settings-field">
                <span>Max members</span>
                <input
                  type="number"
                  name="maxGroupMembers"
                  min={SOCIAL_MAX_GROUP_MEMBERS_MIN}
                  max={SOCIAL_MAX_GROUP_MEMBERS_MAX}
                  step={1}
                  defaultValue={settings.maxGroupMembers}
                  disabled={pending}
                />
                <span className="settings-hint">0 = no cap.</span>
              </label>
            </div>
          </section>

          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Switches</h3>
            </header>
            <div className="page-settings-panel-body">
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowGroupDocuments"
                  value="1"
                  defaultChecked={settings.allowGroupDocuments}
                  disabled={pending}
                />
                <span>Documents</span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowGroupAnnouncements"
                  value="1"
                  defaultChecked={settings.allowGroupAnnouncements}
                  disabled={pending}
                />
                <span>Announcements</span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowGroupJoinForm"
                  value="1"
                  defaultChecked={settings.allowGroupJoinForm}
                  disabled={pending}
                />
                <span>Join form</span>
              </label>
              <p className="settings-hint">Ranks stay on the group page.</p>
            </div>
          </section>
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

        <div className="page-settings-actions" style={{ marginTop: '1rem' }}>
          <SaveButton pending={pending} />
        </div>
      </form>

      <div className="admin-settings-mosaic" style={{ marginTop: '1.5rem' }}>
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Categories</h3>
          </header>
          <div className="page-settings-panel-body">
            <CreateCategoryForm />
            {categories.length === 0 ? (
              <p className="layout-muted settings-hint">No categories yet.</p>
            ) : (
              <ul className="admin-inline-actions" style={{ listStyle: 'none', padding: 0 }}>
                {categories.map((row) => (
                  <li key={row.id} style={{ marginTop: '0.75rem' }}>
                    <code>{row.name}</code>
                    <span className="settings-hint">
                      {' '}
                      — {row.slug} · {row.kind}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Group list</h3>
          </header>
          <div className="page-settings-panel-body">
            {groups.length === 0 ? (
              <p className="layout-muted settings-hint">No groups yet.</p>
            ) : (
              <ul className="admin-inline-actions" style={{ listStyle: 'none', padding: 0 }}>
                {groups.map((row) => (
                  <li
                    key={row.id}
                    className="admin-control-row"
                    style={{ marginTop: '0.75rem' }}
                  >
                    <span>
                      <code>{row.name}</code>
                      <span className="settings-hint">
                        {' '}
                        — owner {row.ownerUserId}
                        {row.categoryName ? ` · ${row.categoryName}` : ''}
                        {row.verifiedAt ? ' · verified' : ''}
                      </span>
                    </span>
                    <VerifyGroupButton groupId={row.id} verified={Boolean(row.verifiedAt)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
