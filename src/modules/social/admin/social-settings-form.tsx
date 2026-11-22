'use client'

import React, { useActionState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import { saveSocialSettingsAction, type SocialSettingsActionState } from '../actions'
import {
  SOCIAL_COMMENT_LENGTH_LIMIT_MAX,
  SOCIAL_COMMENT_LENGTH_LIMIT_MIN,
  SOCIAL_FEED_PAGE_SIZE_MAX,
  SOCIAL_FEED_PAGE_SIZE_MIN,
  SOCIAL_WRITE_RATE_LIMIT_MAX_MAX,
  SOCIAL_WRITE_RATE_LIMIT_MAX_MIN,
  SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MAX,
  SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MIN,
  type SocialModuleSettings,
} from '../pack-settings'
import { POST_AUDIENCES } from '../posts'
import { SOCIAL_MODULE_ID } from '../ids'
import {
  SOCIAL_CHALLENGE_INVITED_TRIGGER,
  SOCIAL_FRIEND_REQUESTED_TRIGGER,
  SOCIAL_GROUP_ANNOUNCED_TRIGGER,
} from '../triggers'

type Props = {
  settings: SocialModuleSettings
}

const initial: SocialSettingsActionState = {}

const AUDIENCE_LABEL: Record<(typeof POST_AUDIENCES)[number], string> = {
  only_me: 'Only me',
  group: 'Group',
  friends: 'Friends',
  public: 'Public',
}

const MAIL_LINKS = [
  { href: '/admin/email?category=social', label: SOCIAL_FRIEND_REQUESTED_TRIGGER },
  { href: '/admin/email?category=social', label: SOCIAL_GROUP_ANNOUNCED_TRIGGER },
  { href: '/admin/email?category=social', label: SOCIAL_CHALLENGE_INVITED_TRIGGER },
] as const

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

export function SocialSettingsForm({ settings }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(saveSocialSettingsAction, initial)

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
              <h3>Status</h3>
            </header>
            <div className="page-settings-panel-body">
              <p>
                Status: <strong>Enabled</strong>
              </p>
              <p className="settings-hint">
                Read-only. Turn the module on or off under{' '}
                <Link href="/admin/settings">Settings → Modules</Link> ({SOCIAL_MODULE_ID}).
              </p>
            </div>
          </section>

          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Defaults</h3>
            </header>
            <div className="page-settings-panel-body">
              <label className="settings-field">
                <span>Default post audience</span>
                <select
                  name="defaultPostAudience"
                  defaultValue={settings.defaultPostAudience}
                  disabled={pending}
                >
                  {POST_AUDIENCES.map((audience) => (
                    <option key={audience} value={audience}>
                      {AUDIENCE_LABEL[audience]}
                    </option>
                  ))}
                </select>
                <span className="settings-hint">
                  Composer default. Friends, public, only me, or group.
                </span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="guestCanReadPublic"
                  value="1"
                  defaultChecked={settings.guestCanReadPublic}
                  disabled={pending}
                />
                <span>Guest can read public posts</span>
              </label>
              <label className="settings-field">
                <span>Feed page size</span>
                <input
                  type="number"
                  name="feedPageSize"
                  min={SOCIAL_FEED_PAGE_SIZE_MIN}
                  max={SOCIAL_FEED_PAGE_SIZE_MAX}
                  step={1}
                  defaultValue={settings.feedPageSize}
                  disabled={pending}
                />
                <span className="settings-hint">Posts per home-feed page. Default 50.</span>
              </label>
              <label className="settings-field">
                <span>Comment length limit</span>
                <input
                  type="number"
                  name="commentLengthLimit"
                  min={SOCIAL_COMMENT_LENGTH_LIMIT_MIN}
                  max={SOCIAL_COMMENT_LENGTH_LIMIT_MAX}
                  step={1}
                  defaultValue={settings.commentLengthLimit}
                  disabled={pending}
                />
                <span className="settings-hint">Max characters per comment. Default 5000.</span>
              </label>
              <label className="settings-field">
                <span>Member write rate limit</span>
                <input
                  type="number"
                  name="writeRateLimitMax"
                  min={SOCIAL_WRITE_RATE_LIMIT_MAX_MIN}
                  max={SOCIAL_WRITE_RATE_LIMIT_MAX_MAX}
                  step={1}
                  defaultValue={settings.writeRateLimitMax}
                  disabled={pending}
                />
                <span className="settings-hint">
                  Max posts, comments, reactions, requests, and other member writes per window.
                  Default 60.
                </span>
              </label>
              <label className="settings-field">
                <span>Write rate-limit window (seconds)</span>
                <input
                  type="number"
                  name="writeRateLimitWindowSec"
                  min={SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MIN}
                  max={SOCIAL_WRITE_RATE_LIMIT_WINDOW_SEC_MAX}
                  step={1}
                  defaultValue={settings.writeRateLimitWindowSec}
                  disabled={pending}
                />
                <span className="settings-hint">Sliding window for the write bucket. Default 60.</span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="holdNewPostsForReview"
                  value="1"
                  defaultChecked={settings.holdNewPostsForReview}
                  disabled={pending}
                />
                <span>Hold new posts for staff review</span>
              </label>
              <p className="settings-hint">Default off. When on, new posts start staff-hidden.</p>
              <p className="settings-hint">
                Story lifetime, albums, images per post, and challenge windows live under{' '}
                <Link href="/admin/social/media">Media</Link>.
              </p>
            </div>
          </section>

          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Composer and feed</h3>
            </header>
            <div className="page-settings-panel-body">
              {(
                [
                  ['allowText', 'Text posts', settings.allowText],
                  ['allowMedia', 'Media posts', settings.allowMedia],
                  ['allowLink', 'Link posts', settings.allowLink],
                  ['allowShare', 'Share posts', settings.allowShare],
                  ['allowPoll', 'Poll posts', settings.allowPoll],
                  ['allowCheckin', 'Check-in posts', settings.allowCheckin],
                  ['allowChallenge', 'Challenges', settings.allowChallenge],
                  ['allowMentions', 'Mentions', settings.allowMentions],
                  ['allowHashtags', 'Hashtags', settings.allowHashtags],
                  ['allowComments', 'Comments', settings.allowComments],
                  ['allowDiscover', 'Discover tab', settings.allowDiscover],
                  ['allowFollowingTab', 'Following tab', settings.allowFollowingTab],
                  [
                    'allowShortVideoLayout',
                    'Short-video layout (Watch)',
                    settings.allowShortVideoLayout,
                  ],
                ] as const
              ).map(([name, label, checked]) => (
                <label key={name} className="settings-field settings-flag">
                  <input
                    type="checkbox"
                    name={name}
                    value="1"
                    defaultChecked={checked}
                    disabled={pending}
                  />
                  <span>{label}</span>
                </label>
              ))}
              <p className="settings-hint">
                A disabled post kind cannot be created. Tabs that are off are hidden and return
                not found.
              </p>
            </div>
          </section>

          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Activity cards</h3>
            </header>
            <div className="page-settings-panel-body">
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="activityEventPublished"
                  value="1"
                  defaultChecked={settings.activityEventPublished}
                  disabled={pending}
                />
                <span>
                  <code>event.published</code>
                </span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="activityPagePublished"
                  value="1"
                  defaultChecked={settings.activityPagePublished}
                  disabled={pending}
                />
                <span>
                  <code>page.published</code>
                </span>
              </label>
              <p className="settings-hint">
                When a switch is off, that card is not written. Events and Pages publish still
                succeeds.
              </p>
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

      <section className="page-settings-panel" style={{ marginTop: '1.5rem' }}>
        <header className="page-settings-panel-head">
          <h3>Mail</h3>
        </header>
        <div className="page-settings-panel-body">
          <p className="settings-hint">
            Templates and rules stay in Email Manager. This screen does not edit them.
          </p>
          <div className="page-settings-actions">
            {MAIL_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
