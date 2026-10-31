'use client'

import React, { useActionState } from 'react'

import { CodeEditorField } from '@/components/admin/CodeEditorField'
import {
  updateCustomSlotAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import type { LayoutSlot } from '@/core/modules/types'

const initialState: LayoutActionState = {}

function ActionFeedback({ state }: { state: LayoutActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

/**
 * Gantry-like Custom particle settings — HTML / CSS / JS with CodeMirror
 * (syntax highlighting + resizable panels). Plain textareas are intentionally
 * avoided per product preference; Monaco is reserved as an optional later
 * upgrade for a full Styles IDE surface.
 */
export function CustomParticleEditor({
  sectionId,
  rowId,
  slot,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
}) {
  const [state, formAction, pending] = useActionState(updateCustomSlotAction, initialState)
  const cfg = slot.config ?? {}

  return (
    <details className="gantry-custom-editor">
      <summary>Custom particle — HTML / CSS / JS</summary>
      <form action={formAction} className="gantry-custom-form">
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <label className="gantry-custom-title">
          <span>Title</span>
          <input type="text" name="title" defaultValue={String(cfg.title ?? '')} />
        </label>

        <CodeEditorField
          name="html"
          label="HTML"
          language="html"
          initialValue={String(cfg.html ?? '')}
          initialHeight={180}
          placeholder="<p>Custom HTML</p>"
        />
        <CodeEditorField
          name="css"
          label="CSS"
          language="css"
          initialValue={String(cfg.css ?? '')}
          initialHeight={140}
          placeholder=".my-block { color: … }"
        />
        <CodeEditorField
          name="js"
          label="JavaScript"
          language="javascript"
          initialValue={String(cfg.js ?? '')}
          initialHeight={120}
          placeholder="// Stored only — execution gated to developer-admins later"
          hint="JS is saved on the slot but not executed in this foundation slice."
        />

        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Custom'}
        </button>
        <ActionFeedback state={state} />
      </form>
    </details>
  )
}
