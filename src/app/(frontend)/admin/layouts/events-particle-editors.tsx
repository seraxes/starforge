'use client'

/**
 * Layout cog editors for product:events particles.
 * Kept under admin/layouts (same as FormParticleEditor) so modules do not import app UI.
 */

import React, { useActionState, useEffect, useState } from 'react'

import {
  updateSlotConfigAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import type { ParticleEditorProps } from '@/core/modules/particles/editor-props'
import type { LayoutSlotConfig } from '@/core/modules/types'
import {
  defaultEventCalendarConfig,
  readEventCalendarConfig,
  type EventCalendarParticleConfig,
} from '@/modules/events/particles/event-calendar-config'
import {
  defaultEventFeaturedConfig,
  readEventFeaturedConfig,
  type EventFeaturedParticleConfig,
} from '@/modules/events/particles/event-featured-config'
import {
  defaultEventMiniCalendarConfig,
  readEventMiniCalendarConfig,
  type EventMiniCalendarParticleConfig,
} from '@/modules/events/particles/event-mini-calendar-config'
import {
  defaultEventUpcomingConfig,
  readEventUpcomingConfig,
  type EventUpcomingParticleConfig,
} from '@/modules/events/particles/event-upcoming-config'

import { useNotifySavedOnOk } from '../admin-toast'
import { useAutosaveForm } from '../use-autosave-form'
import { LayoutIdField } from './layout-outline-context'
import { ParticleSettingsPopover } from './particle-settings-popover'

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

function EventsParticleEditorShell({
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

export function EventFeaturedParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<EventFeaturedParticleConfig>(() =>
    readEventFeaturedConfig(slot.config),
  )
  useEffect(() => {
    setDraft(readEventFeaturedConfig(slot.config))
  }, [slot.id, slot.config])
  const defaults = defaultEventFeaturedConfig()

  return (
    <EventsParticleEditorShell
      title="Featured carousel"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify({
        heading: draft.heading,
        limit: draft.limit,
        intervalMs: draft.intervalMs,
        includePast: draft.includePast,
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
        <span>Max events</span>
        <input
          type="number"
          min={1}
          max={24}
          value={draft.limit}
          onChange={(e) =>
            setDraft((d) => ({ ...d, limit: Number(e.target.value) || defaults.limit }))
          }
        />
      </label>
      <label className="settings-field">
        <span>Rotate interval (ms, 0 = off)</span>
        <input
          type="number"
          min={0}
          max={120000}
          step={500}
          value={draft.intervalMs}
          onChange={(e) =>
            setDraft((d) => ({ ...d, intervalMs: Number(e.target.value) || 0 }))
          }
        />
      </label>
      <label className="settings-field settings-field-checkbox">
        <input
          type="checkbox"
          checked={draft.includePast}
          onChange={(e) => setDraft((d) => ({ ...d, includePast: e.target.checked }))}
        />
        <span>Include past featured events</span>
      </label>
    </EventsParticleEditorShell>
  )
}

export function EventMiniCalendarParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<EventMiniCalendarParticleConfig>(() =>
    readEventMiniCalendarConfig(slot.config),
  )
  useEffect(() => {
    setDraft(readEventMiniCalendarConfig(slot.config))
  }, [slot.id, slot.config])
  const defaults = defaultEventMiniCalendarConfig()

  return (
    <EventsParticleEditorShell
      title="Mini calendar"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify({
        heading: draft.heading,
        limit: draft.limit,
        showCalendarLink: draft.showCalendarLink,
      })}
      embedded={embedded}
      onConfigSaved={onConfigSaved}
    >
      <label className="settings-field">
        <span>Heading (optional)</span>
        <input
          type="text"
          value={draft.heading}
          onChange={(e) => setDraft((d) => ({ ...d, heading: e.target.value }))}
          placeholder="Current month name"
        />
      </label>
      <label className="settings-field">
        <span>Max events loaded</span>
        <input
          type="number"
          min={1}
          max={100}
          value={draft.limit}
          onChange={(e) =>
            setDraft((d) => ({ ...d, limit: Number(e.target.value) || defaults.limit }))
          }
        />
      </label>
      <label className="settings-field settings-field-checkbox">
        <input
          type="checkbox"
          checked={draft.showCalendarLink}
          onChange={(e) =>
            setDraft((d) => ({ ...d, showCalendarLink: e.target.checked }))
          }
        />
        <span>Show link to calendar view</span>
      </label>
    </EventsParticleEditorShell>
  )
}

export function EventCalendarParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<EventCalendarParticleConfig>(() =>
    readEventCalendarConfig(slot.config),
  )
  useEffect(() => {
    setDraft(readEventCalendarConfig(slot.config))
  }, [slot.id, slot.config])
  const defaults = defaultEventCalendarConfig()

  return (
    <EventsParticleEditorShell
      title="Event calendar"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify({
        heading: draft.heading,
        limit: draft.limit,
        showThumbnails: draft.showThumbnails,
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
        <span>Max events</span>
        <input
          type="number"
          min={1}
          max={200}
          value={draft.limit}
          onChange={(e) =>
            setDraft((d) => ({ ...d, limit: Number(e.target.value) || defaults.limit }))
          }
        />
      </label>
      <label className="settings-field settings-field-checkbox">
        <input
          type="checkbox"
          checked={draft.showThumbnails}
          onChange={(e) =>
            setDraft((d) => ({ ...d, showThumbnails: e.target.checked }))
          }
        />
        <span>Show event thumbnails</span>
      </label>
    </EventsParticleEditorShell>
  )
}

export function EventUpcomingParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<EventUpcomingParticleConfig>(() =>
    readEventUpcomingConfig(slot.config),
  )
  useEffect(() => {
    setDraft(readEventUpcomingConfig(slot.config))
  }, [slot.id, slot.config])
  const defaults = defaultEventUpcomingConfig()

  return (
    <EventsParticleEditorShell
      title="Upcoming events"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify({
        heading: draft.heading,
        emptyMessage: draft.emptyMessage,
        limit: draft.limit,
        includePast: draft.includePast,
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
        />
      </label>
      <label className="settings-field">
        <span>Max events</span>
        <input
          type="number"
          min={1}
          max={100}
          value={draft.limit}
          onChange={(e) =>
            setDraft((d) => ({ ...d, limit: Number(e.target.value) || defaults.limit }))
          }
        />
      </label>
      <label className="settings-field settings-field-checkbox">
        <input
          type="checkbox"
          checked={draft.includePast}
          onChange={(e) => setDraft((d) => ({ ...d, includePast: e.target.checked }))}
        />
        <span>Include past events</span>
      </label>
    </EventsParticleEditorShell>
  )
}
