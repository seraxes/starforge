'use client'

import React, { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'

import { setPostAudienceAction, type SocialFeedActionState } from '../actions'
import type { PostAudience } from '../posts'
import { useDismissible } from './useDismissible'

const initial: SocialFeedActionState = {}

export type AudienceGroup = { id: string; name: string }

/** Who can see this post. The author picks Friends, Public, Only me, or a group they own. */
export function PostAudienceControl({
  postId,
  audience,
  groupId,
  ownedGroups = [],
}: {
  postId: string
  audience: PostAudience
  groupId?: string | null
  ownedGroups?: AudienceGroup[]
}) {
  const t = useTranslations('product:social')
  const [open, setOpen] = useState(false)
  const rootRef = useDismissible<HTMLSpanElement>(open, () => setOpen(false))
  const [state, action, pending] = useActionState(setPostAudienceAction, initial)
  const label: Record<PostAudience, string> = {
    friends: t('audienceFriends'),
    public: t('audiencePublic'),
    only_me: t('audienceOnlyMe'),
    group: t('audienceGroup'),
  }
  const groupName = ownedGroups.find((group) => group.id === groupId)?.name
  const current =
    audience === 'group' && groupName
      ? `${t('audienceGroup')} · ${groupName}`
      : label[audience] ?? t('audienceFriends')
  const choices: { id: PostAudience; label: string; groupId: string }[] = [
    { id: 'friends', label: t('audienceFriends'), groupId: '' },
    { id: 'public', label: t('audiencePublic'), groupId: '' },
    { id: 'only_me', label: t('audienceOnlyMe'), groupId: '' },
    ...ownedGroups.map((group) => ({
      id: 'group' as const,
      label: `${t('audienceGroup')} · ${group.name}`,
      groupId: group.id,
    })),
  ]

  return (
    <span className="sf-social-stage-audience-wrap" ref={rootRef}>
      <button
        type="button"
        className="sf-social-stage-audience"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
      >
        {pending ? t('saving') : `${current} ▾`}
      </button>
      {open ? (
        <ul className="sf-social-stage-audience-menu" role="listbox">
          {choices.map((item) => {
            const selected = item.id === audience && (item.id !== 'group' || item.groupId === groupId)
            return (
              <li key={`${item.id}-${item.groupId || 'self'}`}>
                <form action={action}>
                  <input type="hidden" name="postId" value={postId} />
                  <input type="hidden" name="audience" value={item.id} />
                  <input type="hidden" name="groupId" value={item.groupId} />
                  <button
                    type="submit"
                    role="option"
                    aria-selected={selected}
                    disabled={pending}
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </button>
                </form>
              </li>
            )
          })}
        </ul>
      ) : null}
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </span>
  )
}
