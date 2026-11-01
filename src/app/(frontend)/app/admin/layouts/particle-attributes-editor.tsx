'use client'

import React, { useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { updateSlotAttributesAction } from '@/core/modules/actions'
import type { LayoutSlot } from '@/core/modules/types'

import { useAdminToast } from '../admin-toast'
import { useDebouncedPersist } from '../use-debounced-persist'
import { useLayoutOutlineId } from './layout-outline-context'

type Props = {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  onAttrsSaved?: (attrs: { htmlId?: string; cssClass?: string }) => void
}

type AttrDraft = { htmlId: string; cssClass: string }

/**
 * Optional HTML id + CSS classes — autosave (~500ms + blur), no Save button.
 * Action always rewrites both fields, so drafts keep both values in sync.
 */
export function ParticleAttributesEditor({
  sectionId,
  rowId,
  slot,
  onAttrsSaved,
}: Props) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const { notifySaved, notifyError } = useAdminToast()
  const [pending, startSave] = useTransition()
  const draftRef = useRef<AttrDraft>({
    htmlId: slot.htmlId ?? '',
    cssClass: slot.cssClass ?? '',
  })

  const persist = useCallback(
    (draft: AttrDraft) => {
      if (
        draft.htmlId.trim() === (slot.htmlId ?? '').trim() &&
        draft.cssClass.trim() === (slot.cssClass ?? '').trim()
      ) {
        return
      }
      const fd = new FormData()
      fd.set('layoutId', layoutId)
      fd.set('sectionId', sectionId)
      fd.set('rowId', rowId)
      fd.set('slotId', slot.id)
      fd.set('htmlId', draft.htmlId)
      fd.set('cssClass', draft.cssClass)

      startSave(async () => {
        const result = await updateSlotAttributesAction({}, fd)
        if (result.ok) {
          onAttrsSaved?.({
            htmlId: result.slotAttrs?.htmlId,
            cssClass: result.slotAttrs?.cssClass,
          })
          notifySaved('Saved')
          router.refresh()
        } else if (result.error) {
          notifyError(result.error)
        }
      })
    },
    [
      layoutId,
      notifyError,
      notifySaved,
      onAttrsSaved,
      router,
      rowId,
      sectionId,
      slot.cssClass,
      slot.htmlId,
      slot.id,
    ],
  )

  const { schedule, flush } = useDebouncedPersist(persist)

  const updateDraft = (partial: Partial<AttrDraft>) => {
    draftRef.current = { ...draftRef.current, ...partial }
    return draftRef.current
  }

  return (
    <div className="gantry-typed-form gantry-particle-attrs">
      <p className="gantry-field-hint" style={{ margin: '0 0 0.35rem' }}>
        Block attributes
      </p>
      <div className="gantry-typed-row">
        <label>
          <span>HTML id</span>
          <input
            type="text"
            key={`htmlId-${slot.id}-${slot.htmlId ?? ''}`}
            defaultValue={slot.htmlId ?? ''}
            placeholder="optional"
            spellCheck={false}
            autoComplete="off"
            disabled={pending}
            onChange={(event) => schedule('attrs', updateDraft({ htmlId: event.target.value }))}
            onBlur={(event) => flush('attrs', updateDraft({ htmlId: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                ;(event.target as HTMLInputElement).blur()
              }
            }}
          />
        </label>
        <label>
          <span>CSS class</span>
          <input
            type="text"
            key={`cssClass-${slot.id}-${slot.cssClass ?? ''}`}
            defaultValue={slot.cssClass ?? ''}
            placeholder="optional space-separated"
            spellCheck={false}
            autoComplete="off"
            disabled={pending}
            onChange={(event) => schedule('attrs', updateDraft({ cssClass: event.target.value }))}
            onBlur={(event) => flush('attrs', updateDraft({ cssClass: event.target.value }))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                ;(event.target as HTMLInputElement).blur()
              }
            }}
          />
        </label>
      </div>
      {pending ? <p className="gantry-field-hint">Saving…</p> : null}
    </div>
  )
}
