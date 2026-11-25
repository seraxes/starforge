'use client'

import React, { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { MediaPicker, type MediaPickerValue } from '@/modules/media/api'

import {
  banSocialMemberAction,
  saveSocialPeopleSettingsAction,
  setSocialPostStaffHiddenAction,
  unbanSocialMemberAction,
  type SocialModerationActionState,
  type SocialSettingsActionState,
} from '../actions'
import {
  FRIEND_LIST_VISIBILITIES,
  SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_MAX,
  SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_MIN,
  SOCIAL_MAX_PENDING_FRIEND_REQUESTS_MAX,
  SOCIAL_MAX_PENDING_FRIEND_REQUESTS_MIN,
  SOCIAL_REACTION_ICON_SIZE_PX_MAX,
  SOCIAL_REACTION_ICON_SIZE_PX_MIN,
  type SocialModuleSettings,
} from '../pack-settings'
import {
  DEFAULT_REACTION_ICON_COLORS,
  DEFAULT_REACTION_ICONS,
  REACTION_KINDS,
  sanitizeReactionIconClass,
  type ReactionIconColors,
  type ReactionIconImageUrls,
  type ReactionIconMediaIds,
  type ReactionIcons,
  type ReactionKind,
} from '../reactions'
import { REPORT_REASONS } from '../reports'

type BannedRow = {
  userId: string
  bannedAt: string
}

type HiddenPostRow = {
  id: string
  authorUserId: string
  bodyPreview: string
  updatedAt: string
}

type Props = {
  settings: SocialModuleSettings
  reactionIconMediaUrls?: ReactionIconImageUrls
  banned: BannedRow[]
  hiddenPosts: HiddenPostRow[]
}

const initialSettings: SocialSettingsActionState = {}
const initialModeration: SocialModerationActionState = {}

const FRIEND_LIST_LABEL: Record<(typeof FRIEND_LIST_VISIBILITIES)[number], string> = {
  friends: 'Friends',
  only_me: 'Only me',
}

function emptyMediaPicker(kind: ReactionKind, mediaIds: ReactionIconMediaIds, urls: ReactionIconImageUrls): MediaPickerValue {
  return {
    mediaId: mediaIds[kind] ?? '',
    url: urls[kind] ?? '',
    alt: '',
  }
}

function ReactionKindRows({
  icons,
  colors,
  mediaIds,
  mediaUrls,
  enabledKinds,
  pending,
}: {
  icons: ReactionIcons
  colors: ReactionIconColors
  mediaIds: ReactionIconMediaIds
  mediaUrls: ReactionIconImageUrls
  enabledKinds: Set<string>
  pending: boolean
}) {
  const [drafts, setDrafts] = useState<ReactionIcons>(() => ({ ...icons }))
  const [colorDrafts, setColorDrafts] = useState<ReactionIconColors>(() => ({ ...colors }))
  const [mediaDrafts, setMediaDrafts] = useState<Record<ReactionKind, MediaPickerValue>>(() => {
    const next = {} as Record<ReactionKind, MediaPickerValue>
    for (const kind of REACTION_KINDS) {
      next[kind] = emptyMediaPicker(kind, mediaIds, mediaUrls)
    }
    return next
  })

  return (
    <>
      <input type="hidden" name="reactionKind" value="like" />
      {REACTION_KINDS.map((kind) => {
        const media = mediaDrafts[kind]
        const usesImage = Boolean(media.mediaId?.trim())
        const preview = sanitizeReactionIconClass(drafts[kind]) || DEFAULT_REACTION_ICONS[kind]
        const color = colorDrafts[kind] || DEFAULT_REACTION_ICON_COLORS[kind]
        return (
          <div key={kind} className="sf-social-reaction-kind-row">
            {kind === 'like' ? (
              <label className="settings-field settings-flag">
                <input type="checkbox" defaultChecked disabled />
                <span>like</span>
              </label>
            ) : (
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="reactionKind"
                  value={kind}
                  defaultChecked={enabledKinds.has(kind)}
                  disabled={pending}
                />
                <span>{kind}</span>
              </label>
            )}
            <div className="sf-social-reaction-icon-controls">
              <div className="sf-social-reaction-fa-row">
                <label className="settings-field admin-control-row sf-social-reaction-icon-field">
                  <span
                    className="sf-social-reaction-icon-preview"
                    aria-hidden="true"
                    style={usesImage ? undefined : { color }}
                  >
                    <i className={preview} />
                  </span>
                  <input
                    type="text"
                    name={usesImage ? undefined : `reactionIcon_${kind}`}
                    value={drafts[kind]}
                    disabled={pending || usesImage}
                    spellCheck={false}
                    aria-label={`${kind} icon class`}
                    placeholder={DEFAULT_REACTION_ICONS[kind]}
                    onChange={(event) => {
                      const next = event.target.value
                      setDrafts((current) => ({ ...current, [kind]: next }))
                    }}
                  />
                  {usesImage ? (
                    <input type="hidden" name={`reactionIcon_${kind}`} value={drafts[kind]} />
                  ) : null}
                </label>
                <label className="settings-field sf-social-reaction-color-field">
                  <span className="sr-only">{kind} icon color</span>
                  <input
                    type="color"
                    name={usesImage ? undefined : `reactionIconColor_${kind}`}
                    value={color}
                    disabled={pending || usesImage}
                    aria-label={`${kind} icon color`}
                    onChange={(event) => {
                      const next = event.target.value
                      setColorDrafts((current) => ({ ...current, [kind]: next }))
                    }}
                  />
                  {usesImage ? (
                    <input type="hidden" name={`reactionIconColor_${kind}`} value={color} />
                  ) : null}
                </label>
              </div>
              <div className="sf-social-reaction-media-row">
                <div className="sf-social-reaction-media-field">
                  <MediaPicker
                    label="Image"
                    value={media}
                    defaultFolder="general"
                    defaultPurpose="logo"
                    disabled={pending}
                    allowUrlFallback={false}
                    showPreview={false}
                    mediaIdName={`reactionIconMedia_${kind}`}
                    onChange={(next) => {
                      setMediaDrafts((current) => ({ ...current, [kind]: next }))
                    }}
                  />
                </div>
                <span className="sf-social-reaction-media-thumb" aria-hidden="true">
                  {usesImage && media.url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Media library redirect
                    <img src={media.url} alt="" />
                  ) : null}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
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

function BanMemberForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(banSocialMemberAction, initialModeration)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="admin-control-row">
      <label className="settings-field">
        <span>User id</span>
        <input type="text" name="userId" required disabled={pending} />
      </label>
      <button type="submit" className="gantry-toolbar-btn" disabled={pending}>
        {pending ? 'Banning…' : 'Ban'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="admin-inline-ok" role="status">
          Member banned.
        </p>
      ) : null}
    </form>
  )
}

function UnbanButton({ userId }: { userId: string }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(unbanSocialMemberAction, initialModeration)
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      <button type="submit" className="gantry-toolbar-btn" disabled={pending}>
        {pending ? 'Unbanning…' : 'Unban'}
      </button>
      {state.error ? <p className="admin-inline-error">{state.error}</p> : null}
    </form>
  )
}

function RestorePostButton({ postId }: { postId: string }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    setSocialPostStaffHiddenAction,
    initialModeration,
  )
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction}>
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="staffHidden" value="0" />
      <button type="submit" className="gantry-toolbar-btn" disabled={pending}>
        {pending ? 'Restoring…' : 'Restore'}
      </button>
      {state.error ? <p className="admin-inline-error">{state.error}</p> : null}
    </form>
  )
}

function HidePostForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    setSocialPostStaffHiddenAction,
    initialModeration,
  )
  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  return (
    <form action={formAction} className="admin-control-row">
      <label className="settings-field">
        <span>Post id</span>
        <input type="text" name="postId" required disabled={pending} />
      </label>
      <input type="hidden" name="staffHidden" value="1" />
      <button type="submit" className="gantry-toolbar-btn" disabled={pending}>
        {pending ? 'Hiding…' : 'Hide'}
      </button>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="admin-inline-ok" role="status">
          Post hidden.
        </p>
      ) : null}
    </form>
  )
}

export function SocialPeopleSettingsForm({
  settings,
  reactionIconMediaUrls = {},
  banned,
  hiddenPosts,
}: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    saveSocialPeopleSettingsAction,
    initialSettings,
  )

  useNotifySavedOnOk(state)

  useEffect(() => {
    if (state.ok) router.refresh()
  }, [state, router])

  const enabledKinds = new Set(settings.enabledReactionKinds)
  const enabledReasons = new Set(settings.enabledReportReasons)

  return (
    <>
      <form action={formAction}>
        <div className="page-settings-actions" style={{ marginBottom: '1rem' }}>
          <SaveButton pending={pending} />
        </div>

        <div className="admin-settings-mosaic sf-social-settings">
          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Friends and follow</h3>
            </header>
            <div className="page-settings-panel-body">
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowFriendRequests"
                  value="1"
                  defaultChecked={settings.allowFriendRequests}
                  disabled={pending}
                />
                <span>Friend requests</span>
              </label>
              <label className="settings-field">
                <span>Max pending requests per member</span>
                <input
                  type="number"
                  name="maxPendingFriendRequests"
                  min={SOCIAL_MAX_PENDING_FRIEND_REQUESTS_MIN}
                  max={SOCIAL_MAX_PENDING_FRIEND_REQUESTS_MAX}
                  step={1}
                  defaultValue={settings.maxPendingFriendRequests}
                  disabled={pending}
                />
                <span className="settings-hint">0 = no cap. Default 50.</span>
              </label>
              <label className="settings-field">
                <span>Default friend-list visibility</span>
                <select
                  name="friendListVisibility"
                  defaultValue={settings.friendListVisibility}
                  disabled={pending}
                >
                  {FRIEND_LIST_VISIBILITIES.map((visibility) => (
                    <option key={visibility} value={visibility}>
                      {FRIEND_LIST_LABEL[visibility]}
                    </option>
                  ))}
                </select>
                <span className="settings-hint">Who can see a member’s friend list.</span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowFollow"
                  value="1"
                  defaultChecked={settings.allowFollow}
                  disabled={pending}
                />
                <span>Follow</span>
              </label>
            </div>
          </section>

          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Reactions</h3>
            </header>
            <div className="page-settings-panel-body">
              <ReactionKindRows
                icons={settings.reactionIcons}
                colors={settings.reactionIconColors}
                mediaIds={settings.reactionIconMediaIds}
                mediaUrls={reactionIconMediaUrls}
                enabledKinds={enabledKinds}
                pending={pending}
              />
              <p className="settings-hint">
                <code>like</code> stays on. A disabled kind is refused. Font Awesome classes use site
                FA (Layouts → Page settings); empty restores the default. Color tints FA glyphs.
                An image replaces both class and color for that kind.
              </p>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="showReactionLabels"
                  value="1"
                  defaultChecked={settings.showReactionLabels}
                  disabled={pending}
                />
                <span>Show reaction text labels</span>
              </label>
              <label className="settings-field">
                <span>Tray icon size (px)</span>
                <input
                  type="number"
                  name="reactionIconSizePx"
                  min={SOCIAL_REACTION_ICON_SIZE_PX_MIN}
                  max={SOCIAL_REACTION_ICON_SIZE_PX_MAX}
                  step={1}
                  defaultValue={settings.reactionIconSizePx}
                  disabled={pending}
                />
                <span className="settings-hint">
                  {SOCIAL_REACTION_ICON_SIZE_PX_MIN}–{SOCIAL_REACTION_ICON_SIZE_PX_MAX}. Only the
                  hover/hold reaction popup — not the main Like control or summary chips.
                </span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowReactionsOnComments"
                  value="1"
                  defaultChecked={settings.allowReactionsOnComments}
                  disabled={pending}
                />
                <span>Reactions on comments</span>
              </label>
              <label className="settings-field settings-flag">
                <input
                  type="checkbox"
                  name="allowReactionsOnStories"
                  value="1"
                  defaultChecked={settings.allowReactionsOnStories}
                  disabled={pending}
                />
                <span>Reactions on stories</span>
              </label>
            </div>
          </section>

          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Reports</h3>
            </header>
            <div className="page-settings-panel-body">
              {REPORT_REASONS.map((reason) => (
                <label key={reason} className="settings-field settings-flag">
                  <input
                    type="checkbox"
                    name="reportReason"
                    value={reason}
                    defaultChecked={enabledReasons.has(reason)}
                    disabled={pending}
                  />
                  <span>{reason}</span>
                </label>
              ))}
              <p className="settings-hint">
                At least one reason stays available. Empty save restores the full catalog.
              </p>
              <label className="settings-field">
                <span>Auto-hide after N open reports</span>
                <input
                  type="number"
                  name="autoHideOpenReportThreshold"
                  min={SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_MIN}
                  max={SOCIAL_AUTO_HIDE_OPEN_REPORT_THRESHOLD_MAX}
                  step={1}
                  defaultValue={settings.autoHideOpenReportThreshold}
                  disabled={pending}
                />
                <span className="settings-hint">0 = off. Staff-hides the post when reached.</span>
              </label>
            </div>
          </section>

          <section className="page-settings-panel">
            <header className="page-settings-panel-head">
              <h3>Word list</h3>
            </header>
            <div className="page-settings-panel-body">
              <label className="settings-field">
                <span>Blocked words</span>
                <textarea
                  name="blockedWords"
                  rows={4}
                  defaultValue={settings.blockedWords.join('\n')}
                  disabled={pending}
                  placeholder="one word per line"
                />
                <span className="settings-hint">
                  Case-insensitive. Matching text refuses a post or comment.
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

      <div className="admin-settings-mosaic" style={{ marginTop: '1.5rem' }}>
        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Banned members</h3>
          </header>
          <div className="page-settings-panel-body">
            <BanMemberForm />
            {banned.length === 0 ? (
              <p className="layout-muted settings-hint">No banned members.</p>
            ) : (
              <ul className="admin-inline-actions" style={{ listStyle: 'none', padding: 0 }}>
                {banned.map((row) => (
                  <li
                    key={row.userId}
                    className="admin-control-row"
                    style={{ marginTop: '0.75rem' }}
                  >
                    <span>
                      <code>{row.userId}</code>
                      <span className="settings-hint"> — {row.bannedAt}</span>
                    </span>
                    <UnbanButton userId={row.userId} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="page-settings-panel">
          <header className="page-settings-panel-head">
            <h3>Staff-hidden posts</h3>
          </header>
          <div className="page-settings-panel-body">
            <HidePostForm />
            {hiddenPosts.length === 0 ? (
              <p className="layout-muted settings-hint">No staff-hidden posts.</p>
            ) : (
              <ul className="admin-inline-actions" style={{ listStyle: 'none', padding: 0 }}>
                {hiddenPosts.map((row) => (
                  <li
                    key={row.id}
                    className="admin-control-row"
                    style={{ marginTop: '0.75rem' }}
                  >
                    <span>
                      <code>{row.id}</code>
                      <span className="settings-hint">
                        {' '}
                        — {row.authorUserId}
                        {row.bodyPreview ? `: ${row.bodyPreview}` : ''}
                      </span>
                    </span>
                    <RestorePostButton postId={row.id} />
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
