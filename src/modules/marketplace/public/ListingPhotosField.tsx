'use client'

import React, { useEffect, useState } from 'react'

import { MediaPicker, type MediaPickerValue } from '@/modules/media/api'

type Props = {
  initialIds: string[]
  photoCap: number
  disabled?: boolean
}

/**
 * Ordered listing photos via MediaPicker (append one at a time), capped by settings.
 */
export function ListingPhotosField({ initialIds, photoCap, disabled }: Props) {
  const [ids, setIds] = useState(() => [...initialIds])
  const [draft, setDraft] = useState<MediaPickerValue>({ mediaId: '', url: '', alt: '' })

  useEffect(() => {
    const id = (draft.mediaId || '').trim()
    if (!id) return
    setIds((prev) => {
      if (prev.includes(id)) return prev
      if (prev.length >= photoCap) return prev
      return [...prev, id]
    })
    setDraft({ mediaId: '', url: '', alt: '' })
  }, [draft.mediaId, photoCap])

  const atCap = ids.length >= photoCap

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
              <code>{id}</code>
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
          <MediaPicker
            key={ids.join(',') || 'empty'}
            label="Add photo"
            value={draft}
            defaultFolder="general"
            defaultPurpose="photo"
            disabled={disabled}
            includeHiddenInputs={false}
            allowUrlFallback={false}
            onChange={setDraft}
          />
        </div>
      ) : (
        <p className="settings-hint">Photo cap reached.</p>
      )}
      <input type="hidden" name="mediaIdsJson" value={JSON.stringify(ids)} />
    </fieldset>
  )
}
