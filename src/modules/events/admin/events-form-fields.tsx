'use client'

import React, { useState } from 'react'

import { AccessTagsField } from '@/components/admin/AccessTagsField'
import type { UserGroupOption } from '@/core/acl/types'
import { MediaPicker } from '@/modules/media/api'

type CoverAndAccessProps = {
  coverMediaId: string
  accessTags: string[]
  groups: UserGroupOption[]
  disabled?: boolean
  coverLabel?: string
}

/**
 * Shared Media cover + ACL tags for venue/event forms.
 * Writes hidden inputs `coverMediaId` + `accessTagsJson` for FormData actions.
 */
export function CoverAndAccessFields({
  coverMediaId: initialCover,
  accessTags: initialTags,
  groups,
  disabled,
  coverLabel = 'Cover',
}: CoverAndAccessProps) {
  const [coverMediaId, setCoverMediaId] = useState(initialCover)
  const [accessTags, setAccessTags] = useState(
    initialTags.length > 0 ? initialTags : ['public'],
  )

  return (
    <>
      <div className="settings-field">
        <MediaPicker
          label={coverLabel}
          value={{ mediaId: coverMediaId, url: '', alt: '' }}
          defaultFolder="general"
          defaultPurpose="photo"
          disabled={disabled}
          includeHiddenInputs={false}
          allowUrlFallback={false}
          hint="Bind a Media library id — shared Media Manager, not a per-module library."
          onChange={(next) => setCoverMediaId(next.mediaId)}
        />
        <input type="hidden" name="coverMediaId" value={coverMediaId} />
      </div>
      <AccessTagsField
        value={accessTags}
        groups={groups}
        disabled={disabled}
        legend="Who can see"
        onChange={setAccessTags}
      />
      <input type="hidden" name="accessTagsJson" value={JSON.stringify(accessTags)} />
    </>
  )
}

/** Format Date → `datetime-local` value (local wall clock). */
export function toDatetimeLocalValue(isoOrDate: string | Date | null | undefined): string {
  if (!isoOrDate) return ''
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
