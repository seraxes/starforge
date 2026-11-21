'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  saveSocialPagesSettingsAction,
  setSocialPageVerifiedAction,
  type SocialModerationActionState,
  type SocialSettingsActionState,
} from '../actions'
import {
  SOCIAL_CREATOR_ROLES,
  type SocialModuleSettings,
} from '../pack-settings'

type PageRow = {
  id: string
  name: string
  slug: string
  ownerUserId: string
  sitePageId: string
  verifiedAt: string
}

type Props = {
  settings: SocialModuleSettings
  pages: PageRow[]
}

const initialSettings: SocialSettingsActionState = {}
const initialModeration: SocialModerationActionState = {}

const CREATOR_LABEL: Record<(typeof SOCIAL_CREATOR_ROLES)[number], string> = {
  members: 'Members',
  staff: 'Staff only',
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

function VerifyPageButton({ pageId, verified }: { pageId: string; verified: boolean }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    setSocialPageVerifiedAction,
    initialModeration,
  )
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction}>
      <input type="hidden" name="pageId" value={pageId} />
      <input type="hidden" name="verified" value={verified ? '0' : '1'} />
      <button type="submit" className="gantry-toolbar-btn" disabled={pending}>
        {pending ? 'Updating…' : verified ? 'Clear verified' : 'Verify'}
      </button>
      {state.error ? <p className="admin-inline-error">{state.error}</p> : null}
    </form>
  )
}

export function SocialPagesSettingsForm({ settings, pages }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    saveSocialPagesSettingsAction,
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
              <h3>Pages</h3>
            </header>
            <div className="page-settings-panel-body">
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowPages"
                  value="1"
                  defaultChecked={settings.allowPages}
                  disabled={pending}
                />
                <span>Pages on</span>
              </label>
              <label className="settings-field">
                <span>Who can create one</span>
                <select
                  name="pageWhoCanCreate"
                  defaultValue={settings.pageWhoCanCreate}
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
                  name="pagesNeedApproval"
                  value="1"
                  defaultChecked={settings.pagesNeedApproval}
                  disabled={pending}
                />
                <span>New pages need approval</span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowPageLikes"
                  value="1"
                  defaultChecked={settings.allowPageLikes}
                  disabled={pending}
                />
                <span>Likes</span>
              </label>
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
            <h3>Page list</h3>
          </header>
          <div className="page-settings-panel-body">
            {pages.length === 0 ? (
              <p className="layout-muted settings-hint">No pages yet.</p>
            ) : (
              <ul className="admin-inline-actions" style={{ listStyle: 'none', padding: 0 }}>
                {pages.map((row) => (
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
                        {row.sitePageId ? ` · site ${row.sitePageId}` : ''}
                        {row.verifiedAt ? ' · verified' : ''}
                      </span>
                    </span>
                    <VerifyPageButton pageId={row.id} verified={Boolean(row.verifiedAt)} />
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
