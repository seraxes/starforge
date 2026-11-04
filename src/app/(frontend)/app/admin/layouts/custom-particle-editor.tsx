'use client'

import React, { useActionState, useEffect, useState } from 'react'

import { CodeEditorField } from '@/components/admin/CodeEditorField'
import {
  updateSlotConfigAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import type { LayoutSlot, LayoutSlotConfig } from '@/core/modules/types'

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'
import { LayoutIdField } from './layout-outline-context'
import { ParticleSettingsPopover } from './particle-settings-popover'

const initialState: LayoutActionState = {}

function ActionFeedback({ state }: { state: LayoutActionState }) {
  if (state.error) {
    return (
      <p className="admin-inline-error" role="alert">
        {state.error}
      </p>
    )
  }
  return null
}

/**
 * Custom particle — HTML / CSS / JS. Autosaves (Site Settings debounce) on edit; local title draft
 * stays stable across saves (no form remount / focus loss).
 */
export function CustomParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded = false,
  onConfigSaved,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  /** When true, render form only (parent owns the gear popup). */
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
}) {
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useNotifySavedOnOk(state, { toastErrors: true })
  const { formRef, saveDebounced, saveNow } = useAutosaveForm()

  const cfg = slot.config ?? {}
  const [title, setTitle] = useState(() => String(cfg.title ?? ''))
  const [html, setHtml] = useState(() => String(cfg.html ?? ''))
  const [css, setCss] = useState(() => String(cfg.css ?? ''))
  const [js, setJs] = useState(() => String(cfg.js ?? ''))
  // Remount code editors only when switching particles — not after each autosave.
  const [editorEpoch, setEditorEpoch] = useState(0)

  useEffect(() => {
    const next = slot.config ?? {}
    setTitle(String(next.title ?? ''))
    setHtml(String(next.html ?? ''))
    setCss(String(next.css ?? ''))
    setJs(String(next.js ?? ''))
    setEditorEpoch((n) => n + 1)
  }, [slot.id])

  useEffect(() => {
    if (!state.ok || !state.config) return
    onConfigSaved?.(state.config)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [state.ok, state.config, state.message])

  const configJson = JSON.stringify({ title, html, css, js })

  const form = (
    <form
      ref={formRef}
      action={formAction}
      className="gantry-custom-form"
      onInput={saveDebounced}
      onBlur={(e) => {
        const t = e.target
        if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) saveNow()
      }}
    >
      <LayoutIdField />
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="slotId" value={slot.id} />
      <input type="hidden" name="configJson" value={configJson} />
      <label className="gantry-custom-title">
        <span>Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <CodeEditorField
        key={`html-${slot.id}-${editorEpoch}`}
        label="HTML"
        language="html"
        initialValue={html}
        initialHeight={180}
        placeholder="<p>Custom HTML</p>"
        onValueChange={(value) => {
          setHtml(value)
          saveDebounced()
        }}
      />
      <CodeEditorField
        key={`css-${slot.id}-${editorEpoch}`}
        label="CSS"
        language="css"
        initialValue={css}
        initialHeight={140}
        placeholder=".my-block { color: … }"
        onValueChange={(value) => {
          setCss(value)
          saveDebounced()
        }}
      />
      <CodeEditorField
        key={`js-${slot.id}-${editorEpoch}`}
        label="JavaScript"
        language="javascript"
        initialValue={js}
        initialHeight={120}
        placeholder="// Stored only — execution gated to developer-admins later"
        hint="JS is saved on the slot but not executed in this foundation slice."
        onValueChange={(value) => {
          setJs(value)
          saveDebounced()
        }}
      />

      {pending ? <p className="layout-muted">Saving…</p> : null}
      <ActionFeedback state={state} />
    </form>
  )

  if (embedded) return form
  return (
    <ParticleSettingsPopover title="Custom particle — HTML / CSS / JS">{form}</ParticleSettingsPopover>
  )
}
