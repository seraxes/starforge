'use client'

import React, { useActionState, useEffect, useRef, useState } from 'react'

import { MemberMediaPicker } from '@/modules/media/api'
import { insertTextIntoValue } from '@/modules/rich-editor/api'

import { createTextPostAction, type SocialFeedActionState } from '../actions'
import { POST_MEDIA_IMAGE_MAX } from '../posts'
import { SocialAvatar } from './SocialAvatar'
import { SocialEmojiInsertButton } from './SocialEmojiInsert'
import { useDismissible } from './useDismissible'
import {
  bodyWithoutUrl,
  firstHttpUrl,
  stageBlockHasContent,
  stageCanPost,
  stageNeedsReplace,
  stageReplacePrompt,
  stageSubmitFields,
  type StageBlock,
  type StageBlockKind,
} from '../stage'

const initial: SocialFeedActionState = {}

export type FeedComposerOwnedGroup = {
  id: string
  name: string
}

type PendingReplace =
  | { source: 'instrument'; kind: StageBlockKind }
  | { source: 'paste'; url: string; body: string }

const AUDIENCE_LABEL: Record<string, string> = {
  friends: 'Friends',
  public: 'Public',
  only_me: 'Only me',
  group: 'Group',
}

/**
 * Home-feed stage. The card the member builds is the card the feed will show.
 * One exclusive block: photos, link, vote, or place. Words ride along.
 */
export function FeedComposer({
  ownedGroups = [],
  defaultAudience = 'friends',
  authorName = 'You',
  authorAvatarSrc = null,
  allowText = true,
  allowMedia = false,
  allowLink = false,
  allowPoll = false,
  allowCheckin = false,
  maxImages = POST_MEDIA_IMAGE_MAX,
  imageMaxWidth = 720,
  imageMaxHeight = 540,
}: {
  ownedGroups?: FeedComposerOwnedGroup[]
  /** Pack default. Group falls back to friends when the author owns no group. */
  defaultAudience?: string
  authorName?: string
  authorAvatarSrc?: string | null
  allowText?: boolean
  allowMedia?: boolean
  allowLink?: boolean
  allowPoll?: boolean
  allowCheckin?: boolean
  maxImages?: number
  imageMaxWidth?: number
  imageMaxHeight?: number
}) {
  const [state, formAction, pending] = useActionState(createTextPostAction, initial)
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [block, setBlock] = useState<StageBlock | null>(null)
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null)
  const [tool, setTool] = useState<StageBlockKind | null>(null)
  const [linkDraft, setLinkDraft] = useState('')
  const [linkError, setLinkError] = useState('')
  const [draftMediaId, setDraftMediaId] = useState('')
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const groupAllowed = ownedGroups.length > 0
  const imageCap = Math.min(
    POST_MEDIA_IMAGE_MAX,
    Number.isInteger(maxImages) && maxImages > 0 ? maxImages : POST_MEDIA_IMAGE_MAX,
  )
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
  const [audienceOpen, setAudienceOpen] = useState(false)
  const audienceRef = useDismissible<HTMLSpanElement>(audienceOpen, () =>
    setAudienceOpen(false),
  )

  const expanded = open || body.trim().length > 0 || block !== null
  const mediaIds = block?.kind === 'media' ? block.mediaIds : []
  const atMax = mediaIds.length >= imageCap
  const fields = stageSubmitFields(block)
  const canPost = stageCanPost({ body, block, allowText })

  useEffect(() => {
    if (!state.ok) return
    setBody('')
    setBlock(null)
    setOpen(false)
    setTool(null)
    setPendingReplace(null)
    setLinkDraft('')
    setLinkError('')
    setDraftMediaId('')
  }, [state.ok, state.postId])

  function startKind(kind: StageBlockKind) {
    setOpen(true)
    setTool(kind)
    setLinkError('')
    if (kind === 'media') {
      setBlock((current) => (current?.kind === 'media' ? current : { kind: 'media', mediaIds: [] }))
      return
    }
    if (kind === 'link') {
      setLinkDraft(block?.kind === 'link' ? block.url : '')
      return
    }
    if (kind === 'poll') {
      setBlock((current) =>
        current?.kind === 'poll' ? current : { kind: 'poll', options: ['', ''] },
      )
      return
    }
    setBlock((current) => (current?.kind === 'place' ? current : { kind: 'place', label: '' }))
  }

  function chooseInstrument(kind: StageBlockKind) {
    if (stageNeedsReplace(block, kind)) {
      setPendingReplace({ source: 'instrument', kind })
      setOpen(true)
      return
    }
    startKind(kind)
  }

  function confirmReplace() {
    if (!pendingReplace) return
    if (pendingReplace.source === 'paste') {
      setBody(pendingReplace.body)
      setBlock({ kind: 'link', url: pendingReplace.url })
      setTool(null)
      setOpen(true)
      setPendingReplace(null)
      return
    }
    setBlock(null)
    setPendingReplace(null)
    startKind(pendingReplace.kind)
  }

  function removeBlock() {
    if (block?.kind === 'link' && block.url && !body.includes(block.url)) {
      setBody((current) => (current.trim() ? `${current.trim()}\n${block.url}` : block.url))
    }
    setBlock(null)
    setTool(null)
    setLinkDraft('')
    setPendingReplace(null)
  }

  function applyLink(url: string, nextBody: string) {
    if (block && block.kind !== 'link' && stageBlockHasContent(block)) {
      setPendingReplace({ source: 'paste', url, body: nextBody })
      setOpen(true)
      return
    }
    setBody(nextBody)
    setBlock({ kind: 'link', url })
    setTool(null)
    setLinkDraft('')
    setLinkError('')
    setOpen(true)
  }

  function commitLinkDraft() {
    const url = firstHttpUrl(linkDraft.trim())
    if (!url || url !== linkDraft.trim()) {
      setLinkError('Enter a valid http(s) link.')
      return
    }
    applyLink(url, bodyWithoutUrl(body, url))
  }

  function onPaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    if (!allowLink) return
    const pasted = event.clipboardData.getData('text')
    const url = firstHttpUrl(pasted)
    if (!url) return
    event.preventDefault()
    const el = event.currentTarget
    const nextBody = body.slice(0, el.selectionStart) + pasted + body.slice(el.selectionEnd)
    const cleaned = bodyWithoutUrl(nextBody, url)
    if (block && block.kind !== 'link' && stageBlockHasContent(block)) {
      setBody(nextBody)
      setPendingReplace({ source: 'paste', url, body: cleaned })
      setOpen(true)
      return
    }
    applyLink(url, cleaned)
  }

  function addMedia(mediaId: string) {
    const id = mediaId.trim()
    if (!id) return
    setBlock((current) => {
      const ids = current?.kind === 'media' ? current.mediaIds : []
      if (ids.includes(id) || ids.length >= imageCap) return current?.kind === 'media' ? current : { kind: 'media', mediaIds: ids }
      return { kind: 'media', mediaIds: [...ids, id] }
    })
    setDraftMediaId('')
    setOpen(true)
  }

  function removeMedia(mediaId: string) {
    setBlock((current) => {
      if (current?.kind !== 'media') return current
      const mediaIdsNext = current.mediaIds.filter((id) => id !== mediaId)
      return mediaIdsNext.length > 0 ? { kind: 'media', mediaIds: mediaIdsNext } : null
    })
  }

  const audiences = [
    { id: 'friends', label: 'Friends' },
    { id: 'public', label: 'Public' },
    { id: 'only_me', label: 'Only me' },
    ...(groupAllowed ? [{ id: 'group', label: 'Group' }] : []),
  ]

  return (
    <form
      action={formAction}
      className={`sf-social-stage sf-social-feed-item${expanded ? ' is-open' : ''}`}
      style={
        {
          '--sf-social-media-max-width': `${imageMaxWidth}px`,
          '--sf-social-media-max-height': `${imageMaxHeight}px`,
        } as React.CSSProperties
      }
      onSubmit={(event) => {
        if (!canPost || pending) event.preventDefault()
      }}
    >
      <header className="sf-social-feed-item-head">
        <SocialAvatar src={authorAvatarSrc} size={40} label={authorName} />
        <div className="sf-social-feed-author">
          {expanded ? <span>{authorName}</span> : <span className="layout-muted">Who can see this</span>}
        </div>
        <span className="sf-social-stage-audience-wrap" ref={audienceRef}>
            <button
              type="button"
              className="sf-social-stage-audience"
              aria-expanded={audienceOpen}
              aria-haspopup="listbox"
              disabled={pending}
              onClick={() => setAudienceOpen((value) => !value)}
            >
              {`${AUDIENCE_LABEL[audience] ?? 'Friends'} ▾`}
            </button>
            {audienceOpen ? (
              <ul className="sf-social-stage-audience-menu" role="listbox">
                {audiences.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={audience === item.id}
                      onClick={() => {
                        setAudience(item.id)
                        setAudienceOpen(false)
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {audience === 'group' && groupAllowed ? (
              <select
                name="groupId"
                className="sf-social-stage-group"
                required
                disabled={pending}
                defaultValue={ownedGroups[0]?.id}
                aria-label="Group"
              >
                {ownedGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            ) : null}
        </span>
      </header>

      <div className="sf-social-feed-body">
        <textarea
          ref={bodyRef}
          name="body"
          className="sf-social-stage-caption"
          rows={expanded ? 3 : 1}
          maxLength={8000}
          placeholder="What’s happening?"
          value={body}
          disabled={pending}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setBody(event.target.value)
            setOpen(true)
          }}
          onPaste={onPaste}
        />

        {block?.kind === 'link' ? (
          <p className="sf-social-feed-link">
            <a href={block.url} rel="noopener noreferrer" target="_blank">
              {block.url}
            </a>
            <button type="button" className="ghost" disabled={pending} onClick={removeBlock}>
              Remove
            </button>
          </p>
        ) : null}

        {block?.kind === 'poll' ? (
          <div className="sf-social-poll">
            <ul className="sf-social-poll-options">
              {block.options.map((option, index) => (
                <li key={index} className="sf-social-poll-option">
                  <input
                    type="text"
                    value={option}
                    maxLength={120}
                    placeholder={`Option ${index + 1}`}
                    disabled={pending}
                    aria-label={`Option ${index + 1}`}
                    onChange={(event) => {
                      const value = event.target.value
                      setBlock((current) => {
                        if (current?.kind !== 'poll') return current
                        const options = current.options.slice()
                        options[index] = value
                        return { kind: 'poll', options }
                      })
                    }}
                  />
                </li>
              ))}
            </ul>
            <div className="sf-social-stage-poll-actions">
              {block.options.length < 10 ? (
                <button
                  type="button"
                  className="ghost"
                  disabled={pending}
                  onClick={() =>
                    setBlock((current) =>
                      current?.kind === 'poll'
                        ? { kind: 'poll', options: [...current.options, ''] }
                        : current,
                    )
                  }
                >
                  Add option
                </button>
              ) : null}
              <button type="button" className="ghost" disabled={pending} onClick={removeBlock}>
                Remove vote
              </button>
            </div>
          </div>
        ) : null}

        {block?.kind === 'place' ? (
          <p className="sf-social-feed-checkin">
            <span className="layout-muted">Checked in at </span>
            <input
              type="text"
              value={block.label}
              maxLength={200}
              placeholder="Place name"
              disabled={pending}
              aria-label="Place"
              onChange={(event) => setBlock({ kind: 'place', label: event.target.value })}
            />
            <button type="button" className="ghost" disabled={pending} onClick={removeBlock}>
              Remove
            </button>
          </p>
        ) : null}

        {block?.kind === 'media' && block.mediaIds.length > 0 ? (
          <ul className="sf-social-feed-media">
            {block.mediaIds.map((id) => (
              <li key={id} className="sf-social-feed-media-item">
                {/* eslint-disable-next-line @next/next/no-img-element -- Media library redirect */}
                <img src={`/api/media/${encodeURIComponent(id)}`} alt="" />
                <button
                  type="button"
                  className="ghost sf-social-stage-media-remove"
                  disabled={pending}
                  onClick={() => removeMedia(id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="sf-social-stage-bar">
        <SocialEmojiInsertButton
          disabled={pending}
          targetRef={bodyRef}
          onInsert={(emoji) => {
            setOpen(true)
            const el = bodyRef.current
            const start = el?.selectionStart ?? body.length
            const end = el?.selectionEnd ?? start
            const { value, caret } = insertTextIntoValue(body, emoji, start, end)
            setBody(value)
            requestAnimationFrame(() => {
              const field = bodyRef.current
              if (!field) return
              field.focus()
              field.setSelectionRange(caret, caret)
            })
          }}
        />
        {allowMedia ? (
          <button
            type="button"
            className="secondary"
            disabled={pending || (block?.kind === 'media' && atMax)}
            onClick={() => chooseInstrument('media')}
          >
            Photo
          </button>
        ) : null}
        {allowLink ? (
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={() => chooseInstrument('link')}
          >
            Link
          </button>
        ) : null}
        {allowPoll ? (
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={() => chooseInstrument('poll')}
          >
            Vote
          </button>
        ) : null}
        {allowCheckin ? (
          <button
            type="button"
            className="secondary"
            disabled={pending}
            onClick={() => chooseInstrument('place')}
          >
            Place
          </button>
        ) : null}
        {expanded ? (
          <button type="submit" className="primary" disabled={pending || !canPost}>
            {pending ? 'Posting…' : 'Post'}
          </button>
        ) : null}
      </div>

      {tool === 'link' && block?.kind !== 'link' ? (
        <div className="sf-social-stage-tool">
          <input
            type="url"
            className="sf-social-stage-link-input"
            placeholder="https://"
            value={linkDraft}
            disabled={pending}
            autoComplete="off"
            aria-label="Link"
            onChange={(event) => {
              setLinkDraft(event.target.value)
              setLinkError('')
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              commitLinkDraft()
            }}
          />
          <button type="button" className="secondary" disabled={pending} onClick={commitLinkDraft}>
            Add link
          </button>
        </div>
      ) : null}

      {tool === 'media' && allowMedia && !atMax ? (
        <div className="sf-social-stage-tool">
          <MemberMediaPicker
            key={mediaIds.join(',') || 'empty-media'}
            label={mediaIds.length === 0 ? 'Add photo' : 'Add another photo'}
            value={draftMediaId}
            onChange={addMedia}
            context="social-post"
            chrome="public"
            shape="wide"
            disabled={pending}
            hint={`Up to ${imageCap} images. Files stay in Media.`}
          />
        </div>
      ) : null}

      {pendingReplace ? (
        <p className="sf-social-stage-replace" role="status">
          {pendingReplace.source === 'paste'
            ? stageReplacePrompt(block?.kind ?? 'media', 'link')
            : stageReplacePrompt(block?.kind ?? 'media', pendingReplace.kind)}
          <button type="button" className="secondary" disabled={pending} onClick={confirmReplace}>
            Replace
          </button>
          <button
            type="button"
            className="ghost"
            disabled={pending}
            onClick={() => setPendingReplace(null)}
          >
            Cancel
          </button>
        </p>
      ) : null}

      <input type="hidden" name="audience" value={audience} />
      <input type="hidden" name="linkUrl" value={fields.linkUrl} />
      <input type="hidden" name="placeLabel" value={fields.placeLabel} />
      <input type="hidden" name="pollOptions" value={fields.pollOptions} />
      <input type="hidden" name="mediaIdsJson" value={JSON.stringify(fields.mediaIds)} />

      {linkError ? (
        <p className="sf-social-inline-error" role="alert">
          {linkError}
        </p>
      ) : null}
      {state.error ? (
        <p className="sf-social-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && !expanded ? (
        <p className="sf-social-inline-ok" role="status">
          Posted.
        </p>
      ) : null}
    </form>
  )
}
