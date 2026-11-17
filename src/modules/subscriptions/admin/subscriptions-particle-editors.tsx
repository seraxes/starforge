'use client'

/**
 * Layout cog editor for the subscription-plans particle.
 * Loaded only through the generated particle editor loader.
 */

import React, { useActionState, useEffect, useState } from 'react'

import {
  updateSlotConfigAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import type { ParticleEditorProps } from '@/core/modules/particles/editor-props'
import type { LayoutSlotConfig } from '@/core/modules/types'
import {
  defaultSubscriptionPlansConfig,
  readSubscriptionPlansConfig,
  type SubscriptionPlansParticleConfig,
} from '@/modules/subscriptions/particles/subscription-plans-config'
import { PLAN_TYPE_OPTIONS } from '@/modules/subscriptions/catalog'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { useAutosaveForm } from '@/app/(frontend)/admin/use-autosave-form'
import { LayoutIdField } from '@/app/(frontend)/admin/layouts/layout-outline-context'
import { ParticleSettingsPopover } from '@/app/(frontend)/admin/layouts/particle-settings-popover'

const initialState: LayoutActionState = {}

function useParticleAutosaveResult(
  state: LayoutActionState,
  onConfigSaved?: (config: LayoutSlotConfig) => void,
) {
  useNotifySavedOnOk(state, { toastErrors: true })
  useEffect(() => {
    if (!state.ok || !state.config) return
    onConfigSaved?.(state.config)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only when action result changes
  }, [state.ok, state.config, state.message])
}

function particleFormAutosaveProps(
  saveDebounced: () => void,
  saveNow: () => void,
): React.HTMLAttributes<HTMLFormElement> {
  return {
    onInput: saveDebounced,
    onChange: (e) => {
      const t = e.target
      if (
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLInputElement &&
          (t.type === 'checkbox' || t.type === 'radio' || t.type === 'color'))
      ) {
        saveNow()
      }
    },
    onBlur: (e) => {
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) saveNow()
    },
  }
}

function SubscriptionsParticleEditorShell({
  title,
  sectionId,
  rowId,
  slotId,
  configJson,
  embedded = false,
  onConfigSaved,
  children,
}: {
  title: string
  sectionId: string
  rowId: string
  slotId: string
  configJson: string
  embedded?: boolean
  onConfigSaved?: (config: LayoutSlotConfig) => void
  children: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState(updateSlotConfigAction, initialState)
  useParticleAutosaveResult(state, onConfigSaved)
  const { formRef, saveNow, saveDebounced } = useAutosaveForm()

  const form = (
    <form
      ref={formRef}
      action={formAction}
      className="gantry-typed-form"
      {...particleFormAutosaveProps(saveDebounced, saveNow)}
    >
      <LayoutIdField />
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="rowId" value={rowId} />
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="configJson" value={configJson} />
      {children}
      {pending ? <p className="layout-muted">Saving…</p> : null}
      {state.error ? (
        <p className="admin-inline-error" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  )

  if (embedded) return form
  return <ParticleSettingsPopover title={title}>{form}</ParticleSettingsPopover>
}

export function SubscriptionPlansParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SubscriptionPlansParticleConfig>(() =>
    readSubscriptionPlansConfig(slot.config),
  )
  useEffect(() => {
    setDraft(readSubscriptionPlansConfig(slot.config))
  }, [slot.id, slot.config])
  const defaults = defaultSubscriptionPlansConfig()

  return (
    <SubscriptionsParticleEditorShell
      title="Subscription plans"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify({
        heading: draft.heading,
        emptyMessage: draft.emptyMessage,
        subject: draft.subject,
        limit: draft.limit,
        showDescription: draft.showDescription,
      })}
      embedded={embedded}
      onConfigSaved={onConfigSaved}
    >
      <label className="settings-field">
        <span>Heading</span>
        <input
          type="text"
          value={draft.heading}
          onChange={(e) => setDraft((d) => ({ ...d, heading: e.target.value }))}
          placeholder={defaults.heading}
        />
      </label>
      <label className="settings-field">
        <span>Empty message</span>
        <input
          type="text"
          value={draft.emptyMessage}
          onChange={(e) => setDraft((d) => ({ ...d, emptyMessage: e.target.value }))}
          placeholder={defaults.emptyMessage}
        />
      </label>
      <label className="settings-field">
        <span>Plan type</span>
        <select
          value={draft.subject}
          onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
        >
          <option value="">All types</option>
          {PLAN_TYPE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="settings-field">
        <span>Max plans</span>
        <input
          type="number"
          min={1}
          max={48}
          value={draft.limit}
          onChange={(e) =>
            setDraft((d) => ({ ...d, limit: Number(e.target.value) || defaults.limit }))
          }
        />
      </label>
      <label className="settings-field settings-field-checkbox">
        <input
          type="checkbox"
          checked={draft.showDescription}
          onChange={(e) => setDraft((d) => ({ ...d, showDescription: e.target.checked }))}
        />
        <span>Show plan description</span>
      </label>
    </SubscriptionsParticleEditorShell>
  )
}
