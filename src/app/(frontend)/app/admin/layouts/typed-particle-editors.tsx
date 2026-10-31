'use client'

import React, { useActionState, useState } from 'react'

import {
  updateCopyrightSlotAction,
  updateLogoSlotAction,
  updateSocialSlotAction,
  type LayoutActionState,
} from '@/core/modules/actions'
import {
  readCopyrightConfig,
  readLogoConfig,
  readSocialConfig,
  type SocialLinkItem,
} from '@/core/modules/particles/config'
import type { LayoutSlot } from '@/core/modules/types'

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
  if (state.ok && state.message) {
    return (
      <p className="admin-inline-ok" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

function newSocialId() {
  return `social-${Math.random().toString(36).slice(2, 9)}`
}

export function LogoParticleEditor({
  sectionId,
  rowId,
  slot,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
}) {
  const [state, formAction, pending] = useActionState(updateLogoSlotAction, initialState)
  const cfg = readLogoConfig(slot.config)

  return (
    <ParticleSettingsPopover title="Logo / Image settings">
      <form action={formAction} className="gantry-typed-form">
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <label>
          <span>Payload Media id</span>
          <input type="text" name="mediaId" defaultValue={cfg.mediaId ?? ''} placeholder="optional" />
        </label>
        <label>
          <span>Image URL</span>
          <input
            type="url"
            name="mediaUrl"
            defaultValue={cfg.mediaUrl ?? ''}
            placeholder="https://… or /media/…"
          />
        </label>
        <p className="layout-muted">
          Use Media id when available, or a URL as a placeholder until the media picker lands.
        </p>
        <label>
          <span>Alt text</span>
          <input type="text" name="alt" defaultValue={cfg.alt ?? ''} required />
        </label>
        <div className="gantry-typed-row">
          <label>
            <span>Max width (px)</span>
            <input
              type="number"
              name="maxWidth"
              min={1}
              defaultValue={cfg.maxWidth ?? ''}
              placeholder="e.g. 180"
            />
          </label>
          <label>
            <span>Max height (px)</span>
            <input
              type="number"
              name="maxHeight"
              min={1}
              defaultValue={cfg.maxHeight ?? ''}
              placeholder="e.g. 64"
            />
          </label>
        </div>
        <label>
          <span>Link URL (optional)</span>
          <input type="text" name="linkUrl" defaultValue={cfg.linkUrl ?? ''} placeholder="/" />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Logo / Image'}
        </button>
        <ActionFeedback state={state} />
      </form>
    </ParticleSettingsPopover>
  )
}

export function CopyrightParticleEditor({
  sectionId,
  rowId,
  slot,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
}) {
  const [state, formAction, pending] = useActionState(updateCopyrightSlotAction, initialState)
  const cfg = readCopyrightConfig(slot.config)
  const [yearMode, setYearMode] = useState(cfg.yearMode ?? 'auto')

  return (
    <ParticleSettingsPopover title="Copyright settings">
      <form action={formAction} className="gantry-typed-form">
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <label>
          <span>Text</span>
          <input type="text" name="text" defaultValue={cfg.text ?? ''} />
        </label>
        <label>
          <span>Year mode</span>
          <select
            name="yearMode"
            value={yearMode}
            onChange={(e) => setYearMode(e.target.value === 'manual' ? 'manual' : 'auto')}
          >
            <option value="auto">Auto (current year)</option>
            <option value="manual">Manual</option>
          </select>
        </label>
        {yearMode === 'manual' ? (
          <label>
            <span>Year</span>
            <input type="number" name="year" defaultValue={cfg.year ?? new Date().getFullYear()} />
          </label>
        ) : (
          <input type="hidden" name="year" value={String(cfg.year ?? new Date().getFullYear())} />
        )}
        <label>
          <span>Link URL (optional)</span>
          <input type="text" name="linkUrl" defaultValue={cfg.linkUrl ?? ''} />
        </label>
        <label>
          <span>Link label (optional)</span>
          <input type="text" name="linkLabel" defaultValue={cfg.linkLabel ?? ''} />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Copyright'}
        </button>
        <ActionFeedback state={state} />
      </form>
    </ParticleSettingsPopover>
  )
}

export function SocialParticleEditor({
  sectionId,
  rowId,
  slot,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
}) {
  const [state, formAction, pending] = useActionState(updateSocialSlotAction, initialState)
  const initial = readSocialConfig(slot.config).items ?? []
  const [items, setItems] = useState<SocialLinkItem[]>(
    initial.length > 0
      ? initial
      : [{ id: newSocialId(), platform: '', url: '', label: '', icon: '' }],
  )

  return (
    <ParticleSettingsPopover title="Social links">
      <form action={formAction} className="gantry-typed-form">
        <LayoutIdField />
        <input type="hidden" name="sectionId" value={sectionId} />
        <input type="hidden" name="rowId" value={rowId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />

        <ul className="gantry-social-editor-list">
          {items.map((item, index) => (
            <li key={item.id} className="gantry-social-editor-item">
              <label>
                <span>Platform</span>
                <input
                  type="text"
                  value={item.platform}
                  onChange={(e) => {
                    const next = [...items]
                    next[index] = { ...item, platform: e.target.value }
                    setItems(next)
                  }}
                  placeholder="X / GitHub / …"
                />
              </label>
              <label>
                <span>URL</span>
                <input
                  type="url"
                  value={item.url}
                  onChange={(e) => {
                    const next = [...items]
                    next[index] = { ...item, url: e.target.value }
                    setItems(next)
                  }}
                  placeholder="https://…"
                  required
                />
              </label>
              <label>
                <span>Label</span>
                <input
                  type="text"
                  value={item.label ?? ''}
                  onChange={(e) => {
                    const next = [...items]
                    next[index] = { ...item, label: e.target.value }
                    setItems(next)
                  }}
                  placeholder="optional"
                />
              </label>
              <label>
                <span>Icon</span>
                <input
                  type="text"
                  value={item.icon ?? ''}
                  onChange={(e) => {
                    const next = [...items]
                    next[index] = { ...item, icon: e.target.value }
                    setItems(next)
                  }}
                  placeholder="optional emoji / key"
                />
              </label>
              <button
                type="button"
                className="danger"
                onClick={() => setItems(items.filter((row) => row.id !== item.id))}
                disabled={items.length <= 1}
              >
                Remove link
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="secondary"
          onClick={() =>
            setItems([
              ...items,
              { id: newSocialId(), platform: '', url: '', label: '', icon: '' },
            ])
          }
        >
          Add link
        </button>
        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save Social'}
        </button>
        <ActionFeedback state={state} />
      </form>
    </ParticleSettingsPopover>
  )
}

/** Renders the typed config editor for logo / copyright / social slots. */
export function TypedParticleEditor({
  sectionId,
  rowId,
  slot,
}: {
  sectionId: string
  rowId: string
  slot: LayoutSlot
}) {
  if (slot.moduleId === 'logo') {
    return <LogoParticleEditor sectionId={sectionId} rowId={rowId} slot={slot} />
  }
  if (slot.moduleId === 'copyright') {
    return <CopyrightParticleEditor sectionId={sectionId} rowId={rowId} slot={slot} />
  }
  if (slot.moduleId === 'social') {
    return <SocialParticleEditor sectionId={sectionId} rowId={rowId} slot={slot} />
  }
  return null
}
