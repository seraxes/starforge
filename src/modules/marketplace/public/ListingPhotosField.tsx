'use client'

import React, { useState } from 'react'

import {
  MediaPicker,
  MemberMediaPicker,
  type MediaPickerValue,
} from '@/modules/media/api'

type Props = {
  initialIds: string[]
  photoCap: number
  disabled?: boolean
  /**
   * `member` — public Sell / edit (MemberMediaPicker + library popup).
   * `library` — admin staff editor (full Media library modal).
   */
  picker?: 'member' | 'library'
}

function appendId(prev: string[], id: string, photoCap: number): string[] {
  const next = id.trim()
  if (!next) return prev
  if (prev.includes(next)) return prev
  if (prev.length >= photoCap) return prev
  return [...prev, next]
}

/**
 * Ordered listing photos, capped by settings.
 * Members append via upload / Choose from library; staff use MediaPicker.
 */
export function ListingPhotosField({
  initialIds,
  photoCap,
  disabled,
  picker = 'member',
}: Props) {
  const [ids, setIds] = useState(() => [...initialIds])
  const [draft, setDraft] = useState<MediaPickerValue>({ mediaId: '', url: '', alt: '' })
  const [draftMemberId, setDraftMemberId] = useState('')
  const [memberKey, setMemberKey] = useState(0)

  const atCap = ids.length >= photoCap

  function onLibraryPick(next: MediaPickerValue) {
    const id = (next.mediaId || '').trim()
    if (!id) {
      setDraft(next)
      return
    }
    setIds((prev) => appendId(prev, id, photoCap))
    setDraft({ mediaId: '', url: '', alt: '' })
  }

  function onMemberPick(mediaId: string) {
    const id = mediaId.trim()
    if (!id) {
      setDraftMemberId('')
      return
    }
    setIds((prev) => appendId(prev, id, photoCap))
    setDraftMemberId('')
    setMemberKey((k) => k + 1)
  }

  return (
    <fieldset className="settings-fieldset">
      <legend>Photos</legend>
      <p className="settings-hint">
        Up to {photoCap} photo{photoCap === 1 ? '' : 's'} from the Media library.
      </p>
      {ids.length > 0 ? (
        <ul className="sf-marketplace-photo-list">
          {ids.map((id) => (
            <li key={id} className="sf-marketplace-photo-item">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/media/${id}`}
                alt=""
                className="sf-marketplace-photo-thumb"
              />
              <button
                type="button"
                className="gantry-toolbar-btn gantry-toolbar-btn-muted"
                disabled={disabled}
                onClick={() => setIds((prev) => prev.filter((x) => x !== id))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="settings-hint">No photos yet.</p>
      )}
      {!atCap ? (
        <div className="settings-field">
          {picker === 'library' ? (
            <MediaPicker
              key={ids.join(',') || 'empty'}
              label="Add photo"
              value={draft}
              defaultFolder="general"
              defaultPurpose="photo"
              disabled={disabled}
              includeHiddenInputs={false}
              allowUrlFallback={false}
              onChange={onLibraryPick}
            />
          ) : (
            <MemberMediaPicker
              key={`member-${memberKey}`}
              label="Add photo"
              value={draftMemberId}
              onChange={onMemberPick}
              context="marketplace-listing"
              chrome="public"
              shape="square"
              showPreview={false}
              disabled={disabled}
              hint="Drop a photo on Upload, or choose from your library."
            />
          )}
        </div>
      ) : (
        <p className="settings-hint">Photo cap reached.</p>
      )}
      <input type="hidden" name="mediaIdsJson" value={JSON.stringify(ids)} />
    </fieldset>
  )
}
