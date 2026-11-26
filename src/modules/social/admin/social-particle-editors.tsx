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
  defaultSocialAlbumsConfig,
  readSocialAlbumsConfig,
  socialAlbumsConfigToJson,
  type SocialAlbumsParticleConfig,
} from '@/modules/social/particles/social-albums-config'
import {
  defaultSocialFriendsConfig,
  readSocialFriendsConfig,
  type SocialFriendsParticleConfig,
} from '@/modules/social/particles/social-friends-config'
import {
  defaultSocialGroupsConfig,
  readSocialGroupsConfig,
  socialGroupsConfigToJson,
  type SocialGroupsParticleConfig,
} from '@/modules/social/particles/social-groups-config'
import {
  defaultSocialPagesConfig,
  readSocialPagesConfig,
  socialPagesConfigToJson,
  type SocialPagesParticleConfig,
} from '@/modules/social/particles/social-pages-config'
import {
  scopeIdsToConfigValue,
  type SocialParticleSource,
} from '@/modules/social/particles/social-particle-scope'
import {
  defaultSocialStoriesConfig,
  readSocialStoriesConfig,
  type SocialStoriesParticleConfig,
} from '@/modules/social/particles/social-stories-config'

import { useNotifySavedOnOk } from '@/app/(frontend)/admin/admin-toast'
import { useAutosaveForm } from '@/app/(frontend)/admin/use-autosave-form'
import { LayoutIdField } from '@/app/(frontend)/admin/layouts/layout-outline-context'
import { ParticleSettingsPopover } from '@/app/(frontend)/admin/layouts/particle-settings-popover'

function particleEditorKey(slot: ParticleEditorProps['slot']): string {
  return `${slot.id}:${JSON.stringify(slot.config ?? {})}`
}

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

export function SocialFriendsParticleEditor(props: ParticleEditorProps) {
  return (
    <SocialFriendsParticleEditorInner key={particleEditorKey(props.slot)} {...props} />
  )
}

function SocialFriendsParticleEditorInner({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SocialFriendsParticleConfig>(() =>
    readSocialFriendsConfig(slot.config),
  )
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

function SourceFields({
  source,
  scopeIds,
  scopeLabel,
  onSource,
  onScopeIds,
}: {
  source: SocialParticleSource
  scopeIds: string[]
  scopeLabel: string
  onSource: (source: SocialParticleSource) => void
  onScopeIds: (raw: string) => void
}) {
  return (
    <>
      <label className="settings-field">
        <span>Show</span>
        <select
          value={source}
          onChange={(e) => onSource(e.target.value as SocialParticleSource)}
        >
          <option value="viewer">Logged-in user</option>
          <option value="groups">Selected ids</option>
          <option value="all">All</option>
        </select>
      </label>
      {source === 'groups' ? (
        <label className="settings-field">
          <span>{scopeLabel}</span>
          <input
            type="text"
            value={scopeIdsToConfigValue(scopeIds)}
            onChange={(e) => onScopeIds(e.target.value)}
            placeholder="id1, id2"
          />
        </label>
      ) : null}
    </>
  )
}

export function SocialGroupsParticleEditor(props: ParticleEditorProps) {
  return (
    <SocialGroupsParticleEditorInner key={particleEditorKey(props.slot)} {...props} />
  )
}

function SocialGroupsParticleEditorInner({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SocialGroupsParticleConfig>(() =>
    readSocialGroupsConfig(slot.config),
  )
  const defaults = defaultSocialGroupsConfig()

  return (
    <SocialParticleEditorShell
      title="Social groups"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify(socialGroupsConfigToJson(draft))}
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
      <SourceFields
        source={draft.source}
        scopeIds={draft.scopeIds}
        scopeLabel="Group ids"
        onSource={(source) => setDraft((d) => ({ ...d, source }))}
        onScopeIds={(raw) =>
          setDraft((d) => ({
            ...d,
            scopeIds: raw
              .split(/[\s,]+/)
              .map((part) => part.trim())
              .filter(Boolean),
          }))
        }
      />
      <label className="settings-field settings-flag">
        <span>Show cover images</span>
        <input
          type="checkbox"
          checked={draft.showImages}
          onChange={(e) => setDraft((d) => ({ ...d, showImages: e.target.checked }))}
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

export function SocialPagesParticleEditor(props: ParticleEditorProps) {
  return (
    <SocialPagesParticleEditorInner key={particleEditorKey(props.slot)} {...props} />
  )
}

function SocialPagesParticleEditorInner({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SocialPagesParticleConfig>(() =>
    readSocialPagesConfig(slot.config),
  )
  const defaults = defaultSocialPagesConfig()

  return (
    <SocialParticleEditorShell
      title="Social pages"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify(socialPagesConfigToJson(draft))}
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
      <SourceFields
        source={draft.source}
        scopeIds={draft.scopeIds}
        scopeLabel="Page ids"
        onSource={(source) => setDraft((d) => ({ ...d, source }))}
        onScopeIds={(raw) =>
          setDraft((d) => ({
            ...d,
            scopeIds: raw
              .split(/[\s,]+/)
              .map((part) => part.trim())
              .filter(Boolean),
          }))
        }
      />
      <label className="settings-field settings-flag">
        <span>Show cover images</span>
        <input
          type="checkbox"
          checked={draft.showImages}
          onChange={(e) => setDraft((d) => ({ ...d, showImages: e.target.checked }))}
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

export function SocialAlbumsParticleEditor(props: ParticleEditorProps) {
  return (
    <SocialAlbumsParticleEditorInner key={particleEditorKey(props.slot)} {...props} />
  )
}

function SocialAlbumsParticleEditorInner({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SocialAlbumsParticleConfig>(() =>
    readSocialAlbumsConfig(slot.config),
  )
  const defaults = defaultSocialAlbumsConfig()

  return (
    <SocialParticleEditorShell
      title="Social albums"
      sectionId={sectionId}
      rowId={rowId}
      slotId={slot.id}
      configJson={JSON.stringify(socialAlbumsConfigToJson(draft))}
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
      <SourceFields
        source={draft.source}
        scopeIds={draft.scopeIds}
        scopeLabel="Group ids (empty = my groups)"
        onSource={(source) => setDraft((d) => ({ ...d, source }))}
        onScopeIds={(raw) =>
          setDraft((d) => ({
            ...d,
            scopeIds: raw
              .split(/[\s,]+/)
              .map((part) => part.trim())
              .filter(Boolean),
          }))
        }
      />
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
        <span>Max images</span>
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
    </SocialParticleEditorShell>
  )
}

export function SocialStoriesParticleEditor(props: ParticleEditorProps) {
  return (
    <SocialStoriesParticleEditorInner key={particleEditorKey(props.slot)} {...props} />
  )
}

function SocialStoriesParticleEditorInner({
  sectionId,
  rowId,
  slot,
  embedded,
  onConfigSaved,
}: ParticleEditorProps) {
  const [draft, setDraft] = useState<SocialStoriesParticleConfig>(() =>
    readSocialStoriesConfig(slot.config),
  )
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
