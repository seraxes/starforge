'use client'

/**
 * Layout cog editors for product:social particles.
 */

import React, { useActionState, useEffect, useState } from 'react'

import {
  updateSlotConfigAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import type { ParticleEditorProps } from '@/core/modules/particles/editor-props'
import type { LayoutSlotConfig } from '@/core/modules/types'
import {
  defaultSocialFriendsConfig,
  readSocialFriendsConfig,
  type SocialFriendsParticleConfig,
} from '@/modules/social/particles/social-friends-config'
import {
  defaultSocialGroupsConfig,
  readSocialGroupsConfig,
  type SocialGroupsParticleConfig,
} from '@/modules/social/particles/social-groups-config'
import {
  defaultSocialPagesConfig,
  readSocialPagesConfig,
  type SocialPagesParticleConfig,
} from '@/modules/social/particles/social-pages-config'
import {
  defaultSocialStoriesConfig,
  readSocialStoriesConfig,
  type SocialStoriesParticleConfig,
} from '@/modules/social/particles/social-stories-config'

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

function SocialParticleEditorShell({
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

export function SocialFriendsParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SocialFriendsParticleConfig>(() =>
    readSocialFriendsConfig(slot.config),
  )
  useEffect(() => {
    setDraft(readSocialFriendsConfig(slot.config))
  }, [slot.id, slot.config])
  const defaults = defaultSocialFriendsConfig()

  return (
    <SocialParticleEditorShell
      title="Social friends"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify({
        heading: draft.heading,
        emptyMessage: draft.emptyMessage,
        limit: draft.limit,
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
        <span>Max friends</span>
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
    </SocialParticleEditorShell>
  )
}

export function SocialGroupsParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SocialGroupsParticleConfig>(() =>
    readSocialGroupsConfig(slot.config),
  )
  useEffect(() => {
    setDraft(readSocialGroupsConfig(slot.config))
  }, [slot.id, slot.config])
  const defaults = defaultSocialGroupsConfig()

  return (
    <SocialParticleEditorShell
      title="Social groups"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify({
        heading: draft.heading,
        emptyMessage: draft.emptyMessage,
        limit: draft.limit,
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
        <span>Max groups</span>
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
    </SocialParticleEditorShell>
  )
}

export function SocialPagesParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SocialPagesParticleConfig>(() =>
    readSocialPagesConfig(slot.config),
  )
  useEffect(() => {
    setDraft(readSocialPagesConfig(slot.config))
  }, [slot.id, slot.config])
  const defaults = defaultSocialPagesConfig()

  return (
    <SocialParticleEditorShell
      title="Social pages"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify({
        heading: draft.heading,
        emptyMessage: draft.emptyMessage,
        limit: draft.limit,
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
        <span>Max pages</span>
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
    </SocialParticleEditorShell>
  )
}

export function SocialStoriesParticleEditor({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SocialStoriesParticleConfig>(() =>
    readSocialStoriesConfig(slot.config),
  )
  useEffect(() => {
    setDraft(readSocialStoriesConfig(slot.config))
  }, [slot.id, slot.config])
  const defaults = defaultSocialStoriesConfig()

  return (
    <SocialParticleEditorShell
      title="Social stories"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify({
        heading: draft.heading,
        emptyMessage: draft.emptyMessage,
        limit: draft.limit,
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
        <span>Max stories</span>
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
    </SocialParticleEditorShell>
  )
}
