'use client'

import React, { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import {
  updateSlotAttributesAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import type { LayoutSlot } from '@/core/modules/types'

import { LayoutIdField } from './layout-outline-context'

const initialState: LayoutActionState = {}

type Props = {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  onAttrsSaved?: (attrs: { htmlId?: string; cssClass?: string }) => void
}

/**
 * Optional HTML id + CSS classes for any particle — applied on the public
 * column wrapper (`sf-grid-col`). Shown in Config for every module.
 */
export function ParticleAttributesEditor({
  sectionId,
  rowId,
  slot,
  onAttrsSaved,
}: Props) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateSlotAttributesAction, initialState)

  useEffect(() => {
    if (!state.ok || state.slotAttrs === undefined) return
    onAttrsSaved?.({
      htmlId: state.slotAttrs.htmlId,
      cssClass: state.slotAttrs.cssClass,
    })
    router.refresh()
    // Hydrate only when the server action result changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [state.ok, state.slotAttrs, state.message])

  const attrsKey = `${slot.htmlId ?? ''}|${slot.cssClass ?? ''}`

  return (
    <form
      key={attrsKey}
      action={formAction}
      className="gantry-typed-form gantry-particle-attrs"
    >
      <LayoutIdField />
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="slotId" value={slot.id} />

      <p className="gantry-field-hint" style={{ margin: '0 0 0.35rem' }}>
        Block attributes
      </p>
      <div className="gantry-typed-row">
        <label>
          <span>HTML id</span>
          <input
            type="text"
            name="htmlId"
            defaultValue={slot.htmlId ?? ''}
            placeholder="optional"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
        <label>
          <span>CSS class</span>
          <input
            type="text"
            name="cssClass"
            defaultValue={slot.cssClass ?? ''}
            placeholder="optional space-separated"
            spellCheck={false}
            autoComplete="off"
          />
        </label>
      </div>
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Save attributes'}
      </button>
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
    </form>
  )
}
