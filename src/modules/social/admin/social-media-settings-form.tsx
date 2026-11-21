'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'

import {
  saveSocialMediaSettingsAction,
  type SocialSettingsActionState,
} from '../actions'
import {
  CHALLENGE_LENGTH_DAYS_MAX,
  CHALLENGE_LENGTH_DAYS_MIN,
} from '../challenge'
import {
  SOCIAL_MAX_ALBUM_ITEMS_MAX,
  SOCIAL_MAX_ALBUM_ITEMS_MIN,
  SOCIAL_FEED_IMAGE_MAX_HEIGHT_MAX,
  SOCIAL_FEED_IMAGE_MAX_HEIGHT_MIN,
  SOCIAL_FEED_IMAGE_MAX_WIDTH_MAX,
  SOCIAL_FEED_IMAGE_MAX_WIDTH_MIN,
  SOCIAL_MAX_IMAGES_PER_POST_MAX,
  SOCIAL_MAX_IMAGES_PER_POST_MIN,
  SOCIAL_MULTI_CHALLENGE_CAP_MAX,
  SOCIAL_MULTI_CHALLENGE_CAP_MIN,
  SOCIAL_STORY_LIFETIME_HOURS_MAX,
  SOCIAL_STORY_LIFETIME_HOURS_MIN,
  type SocialModuleSettings,
} from '../pack-settings'

type Props = {
  settings: SocialModuleSettings
}

const initial: SocialSettingsActionState = {}

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

export function SocialMediaSettingsForm({ settings }: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    saveSocialMediaSettingsAction,
    initial,
  )

  useNotifySavedOnOk(state)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction}>
      <div className="page-settings-actions" style={{ marginBottom: '1rem' }}>
        <SaveButton pending={pending} />
      </div>

      <div className="admin-settings-mosaic sf-social-settings">
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Stories</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field settings-flag">
              <input
                type="checkbox"
                name="allowStories"
                value="1"
                defaultChecked={settings.allowStories}
                disabled={pending}
              />
              <span>Stories on</span>
            </label>
            <label className="settings-field">
              <span>Lifetime hours</span>
              <input
                type="number"
                name="storyLifetimeHours"
                min={SOCIAL_STORY_LIFETIME_HOURS_MIN}
                max={SOCIAL_STORY_LIFETIME_HOURS_MAX}
                step={1}
                defaultValue={settings.storyLifetimeHours}
                disabled={pending}
              />
              <span className="settings-hint">
                How long a new story stays visible. Default 24. Range 1–48.
              </span>
            </label>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Albums</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field settings-flag">
              <input
                type="checkbox"
                name="allowAlbums"
                value="1"
                defaultChecked={settings.allowAlbums}
                disabled={pending}
              />
              <span>Albums on</span>
            </label>
            <label className="settings-field">
              <span>Max items per album</span>
              <input
                type="number"
                name="maxAlbumItems"
                min={SOCIAL_MAX_ALBUM_ITEMS_MIN}
                max={SOCIAL_MAX_ALBUM_ITEMS_MAX}
                step={1}
                defaultValue={settings.maxAlbumItems}
                disabled={pending}
              />
            </label>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Media on posts</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field">
              <span>Max images per post</span>
              <input
                type="number"
                name="maxImagesPerPost"
                min={SOCIAL_MAX_IMAGES_PER_POST_MIN}
                max={SOCIAL_MAX_IMAGES_PER_POST_MAX}
                step={1}
                defaultValue={settings.maxImagesPerPost}
                disabled={pending}
              />
              <span className="settings-hint">Default 10. Image plus video stays refused.</span>
            </label>
            <label className="settings-field">
              <span>Feed image max width (px)</span>
              <input
                type="number"
                name="feedImageMaxWidthPx"
                min={SOCIAL_FEED_IMAGE_MAX_WIDTH_MIN}
                max={SOCIAL_FEED_IMAGE_MAX_WIDTH_MAX}
                step={1}
                defaultValue={settings.feedImageMaxWidthPx}
                disabled={pending}
              />
              <span className="settings-hint">Default 720. Wider photos scale down to this.</span>
            </label>
            <label className="settings-field">
              <span>Feed image max height (px)</span>
              <input
                type="number"
                name="feedImageMaxHeightPx"
                min={SOCIAL_FEED_IMAGE_MAX_HEIGHT_MIN}
                max={SOCIAL_FEED_IMAGE_MAX_HEIGHT_MAX}
                step={1}
                defaultValue={settings.feedImageMaxHeightPx}
                disabled={pending}
              />
              <span className="settings-hint">
                Taller photos are cut at the center so one image cannot fill the page.
              </span>
            </label>
            <label className="settings-field settings-flag">
              <input
                type="checkbox"
                name="allowPostVideo"
                value="1"
                defaultChecked={settings.allowPostVideo}
                disabled={pending}
              />
              <span>Video on a post</span>
            </label>
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Challenge</h3>
          </header>
          <div className="page-settings-panel-body">
            <label className="settings-field settings-flag">
              <input
                type="checkbox"
                name="allowChallenge"
                value="1"
                defaultChecked={settings.allowChallenge}
                disabled={pending}
              />
              <span>Challenge on</span>
            </label>
            <label className="settings-field settings-flag">
              <input
                type="checkbox"
                name="allowChallengeWindow24"
                value="1"
                defaultChecked={settings.allowChallengeWindow24}
                disabled={pending}
              />
              <span>Allow the 24-hour window</span>
            </label>
            <label className="settings-field settings-flag">
              <input
                type="checkbox"
                name="allowChallengeWindow48"
                value="1"
                defaultChecked={settings.allowChallengeWindow48}
                disabled={pending}
              />
              <span>Allow the 48-hour window</span>
            </label>
            <label className="settings-field">
              <span>Min length (days)</span>
              <input
                type="number"
                name="challengeMinLengthDays"
                min={CHALLENGE_LENGTH_DAYS_MIN}
                max={CHALLENGE_LENGTH_DAYS_MAX}
                step={1}
                defaultValue={settings.challengeMinLengthDays}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Max length (days)</span>
              <input
                type="number"
                name="challengeMaxLengthDays"
                min={CHALLENGE_LENGTH_DAYS_MIN}
                max={CHALLENGE_LENGTH_DAYS_MAX}
                step={1}
                defaultValue={settings.challengeMaxLengthDays}
                disabled={pending}
              />
            </label>
            <label className="settings-field">
              <span>Premium invite cap</span>
              <input
                type="number"
                name="multiChallengeCap"
                min={SOCIAL_MULTI_CHALLENGE_CAP_MIN}
                max={SOCIAL_MULTI_CHALLENGE_CAP_MAX}
                step={1}
                defaultValue={settings.multiChallengeCap}
                disabled={pending}
              />
              <span className="settings-hint">
                How many people a member with <code>social.challenge.multi</code> may invite.
                Default 10.
              </span>
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
  )
}
