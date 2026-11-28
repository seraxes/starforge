'use client'

import React, { useActionState, useState } from 'react'

import { MemberMediaPicker } from '@/modules/media/api'

import {
  createStoryAction,
  recordStoryViewAction,
  type SocialStoryActionState,
} from '../actions'

const initial: SocialStoryActionState = {}

export function CreateStoryForm() {
  const [state, action, pending] = useActionState(createStoryAction, initial)
  const [mediaId, setMediaId] = useState('')

  return (
    <form action={action} className="sf-social-create-story">
      <input type="hidden" name="mediaId" value={mediaId} />
      <div className="settings-field settings-field-wide">
        <span>Photo or video</span>
        {mediaId ? (
          <div className="sf-social-control-row">
            {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
            <img
              src={`/api/media/${encodeURIComponent(mediaId)}`}
              alt=""
              className="sf-social-story-preview"
            />
            <button
              type="button"
              className="sf-social-btn"
              disabled={pending}
              onClick={() => setMediaId('')}
            >
              Remove
            </button>
          </div>
        ) : (
          <MemberMediaPicker
            key={mediaId || 'empty-story-media'}
            label="Add photo or video"
            value=""
            onChange={(id) => {
              if (id) setMediaId(id)
            }}
            context="social-story"
            chrome="public"
            shape="wide"
            disabled={pending}
            hint="One image or one video. File stays in Media. Expires in 24 hours."
          />
        )}
      </div>
      <div className="sf-social-control-row">
        <button
          type="submit"
          className="sf-social-btn sf-social-btn-primary"
          disabled={pending || !mediaId}
        >
          {pending ? 'Posting…' : 'Post story'}
        </button>
      </div>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? <p className="sf-social-inline-ok">Story posted. It expires in 24 hours.</p> : null}
    </form>
  )
}

export function MarkStorySeenButton({ storyId }: { storyId: string }) {
  const [state, action, pending] = useActionState(recordStoryViewAction, initial)
  return (
    <form action={action} className="sf-social-story-seen-form">
      <input type="hidden" name="storyId" value={storyId} />
      <button type="submit" className="sf-social-btn" disabled={pending}>
        {pending ? 'Marking…' : 'Mark seen'}
      </button>
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
