'use client'

import React, { useActionState, useState } from 'react'

import { MemberMediaPicker } from '@/modules/media/api'

import { createTextPostAction, type SocialFeedActionState } from '../actions'
import { POST_MEDIA_IMAGE_MAX } from '../posts'

const initial: SocialFeedActionState = {}

export type FeedComposerOwnedGroup = {
  id: string
  name: string
}

/**
 * Home-feed composer: caption + MediaPicker (member uploads).
 * Many images or one video (server enforces the mix); empty body alone is refused.
 * Group audience lists groups the author owns.
 */
export function FeedComposer({
  ownedGroups = [],
  defaultAudience = 'friends',
  allowMedia = true,
}: {
  ownedGroups?: FeedComposerOwnedGroup[]
  /** Pack default. Group falls back to friends when the author owns no group. */
  defaultAudience?: string
  /** Pack allowMedia switch. */
  allowMedia?: boolean
}) {
  const [state, formAction, pending] = useActionState(createTextPostAction, initial)
  const [mediaIds, setMediaIds] = useState<string[]>([])
  const [draftMediaId, setDraftMediaId] = useState('')
  const groupAllowed = ownedGroups.length > 0
  const initialAudience =
    defaultAudience === 'group' && !groupAllowed
      ? 'friends'
      : defaultAudience === 'public' ||
          defaultAudience === 'only_me' ||
          defaultAudience === 'group' ||
          defaultAudience === 'friends'
        ? defaultAudience
        : 'friends'
  const [audience, setAudience] = useState(initialAudience)
  const atMax = mediaIds.length >= POST_MEDIA_IMAGE_MAX

  function addMedia(mediaId: string) {
    const id = mediaId.trim()
    if (!id) return
    setMediaIds((prev) => {
      if (prev.includes(id) || prev.length >= POST_MEDIA_IMAGE_MAX) return prev
      return [...prev, id]
    })
    setDraftMediaId('')
  }

  return (
    <form action={formAction} className="sf-social-composer">
      <label className="settings-field">
        <span>What’s on your mind?</span>
        <textarea
          name="body"
          rows={3}
          maxLength={8000}
          placeholder="Write a post…"
          disabled={pending}
        />
      </label>

      <label className="settings-field">
        <span>Link (optional)</span>
        <input
          type="url"
          name="linkUrl"
          placeholder="https://…"
          disabled={pending}
          autoComplete="off"
        />
      </label>

      <label className="settings-field">
        <span>Check-in place (optional)</span>
        <input
          type="text"
          name="placeLabel"
          placeholder="Place name"
          disabled={pending}
          autoComplete="off"
          maxLength={200}
        />
      </label>

      <label className="settings-field settings-field-wide">
        <span>Poll options (optional)</span>
        <textarea
          name="pollOptions"
          rows={3}
          placeholder={'One option per line\nPizza\nSushi'}
          disabled={pending}
          maxLength={2000}
        />
        <span className="settings-hint">2–10 options. Creates a poll instead of a text post.</span>
      </label>

      {allowMedia ? (
        <div className="settings-field settings-field-wide sf-social-composer-media">
          <span>Photos</span>
          {mediaIds.length > 0 ? (
            <ul className="sf-social-composer-media-list">
              {mediaIds.map((id) => (
                <li key={id} className="sf-social-composer-media-item admin-control-row">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
                  <img
                    src={`/api/media/${encodeURIComponent(id)}`}
                    alt=""
                    className="sf-social-composer-media-thumb"
                  />
                  <code>{id}</code>
                  <button
                    type="button"
                    className="gantry-btn"
                    disabled={pending}
                    onClick={() => setMediaIds((prev) => prev.filter((x) => x !== id))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="settings-hint">Optional — many images, or one video.</p>
          )}
          {!atMax ? (
            <MemberMediaPicker
              key={mediaIds.join(',') || 'empty-media'}
              label={mediaIds.length === 0 ? 'Add photo' : 'Add another photo'}
              value={draftMediaId}
              onChange={addMedia}
              context="social-post"
              chrome="public"
              shape="wide"
              disabled={pending}
              hint={`Up to ${POST_MEDIA_IMAGE_MAX} images. Files stay in Media.`}
            />
          ) : (
            <p className="settings-hint">Maximum {POST_MEDIA_IMAGE_MAX} images on one post.</p>
          )}
        </div>
      ) : null}
      <input
        type="hidden"
        name="mediaIdsJson"
        value={JSON.stringify(allowMedia ? mediaIds : [])}
      />

      <div className="admin-control-row sf-social-composer-row">
        <label className="settings-field">
          <span>Audience</span>
          <select
            name="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            disabled={pending}
          >
            <option value="friends">Friends</option>
            <option value="public">Public</option>
            <option value="only_me">Only me</option>
            {groupAllowed ? <option value="group">Group</option> : null}
          </select>
        </label>
        {audience === 'group' && groupAllowed ? (
          <label className="settings-field">
            <span>Group</span>
            <select name="groupId" required disabled={pending} defaultValue={ownedGroups[0]?.id}>
              {ownedGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="submit" className="gantry-btn gantry-btn-primary" disabled={pending}>
          {pending ? 'Posting…' : 'Post'}
        </button>
      </div>
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="admin-inline-ok" role="status">
          Posted.
        </p>
      ) : null}
    </form>
  )
}
