'use client'

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { CodeEditorField } from '@/components/admin/CodeEditorField'
import { updateSlotAttributesAction } from '@/core/modules/actions'
import {
  LAYOUT_CSS_PRESET_GROUPS,
  customCssClassTokens,
  mergeCssClassFromParts,
  readPresetFromCssClass,
  type LayoutCssPresetGroupId,
} from '@/core/modules/layout-css-presets'
import type { LayoutSlot } from '@/core/modules/types'

import { useAdminToast } from '../admin-toast'
import { useDebouncedPersist } from '../use-debounced-persist'
import { useLayoutOutlineId } from './layout-outline-context'

type Props = {
  sectionId: string
  rowId: string
  slot: LayoutSlot
  /** Developer-admin may edit particle JS. */
  isDeveloperAdmin?: boolean
  /**
   * Custom particle already has its own CSS and JavaScript fields.
   * HTML id, presets, and extra class stay either way.
   */
  showCodeEditors?: boolean
  onAttrsSaved?: (attrs: {
    htmlId?: string
    cssClass?: string
    particleCss?: string
    particleJs?: string
  }) => void
}

type AttrDraft = {
  htmlId: string
  cssClass: string
  particleCss: string
  particleJs: string
}

/**
 * Block attributes: HTML id, Gantry-style Align/Padding/Margin presets, free CSS
 * class, plus per-particle CSS / JS editors (omitted when the particle already
 * has its own). Autosave (Site Settings debounce + blur).
 */
export function ParticleAttributesEditor({
  sectionId,
  rowId,
  slot,
  isDeveloperAdmin = false,
  showCodeEditors = true,
  onAttrsSaved,
}: Props) {
  const router = useRouter()
  const layoutId = useLayoutOutlineId()
  const { notifySaved, notifyError } = useAdminToast()
  const [pending, startSave] = useTransition()
  const draftRef = useRef<AttrDraft>({
    htmlId: slot.htmlId ?? '',
    cssClass: slot.cssClass ?? '',
    particleCss: slot.particleCss ?? '',
    particleJs: slot.particleJs ?? '',
  })
  const [cssClass, setCssClass] = useState(() => slot.cssClass ?? '')
  const [customClass, setCustomClass] = useState(() => customCssClassTokens(slot.cssClass))
  const [editorEpoch, setEditorEpoch] = useState(0)

  useEffect(() => {
    draftRef.current = {
      htmlId: slot.htmlId ?? '',
      cssClass: slot.cssClass ?? '',
      particleCss: slot.particleCss ?? '',
      particleJs: slot.particleJs ?? '',
    }
    setCssClass(slot.cssClass ?? '')
    setCustomClass(customCssClassTokens(slot.cssClass))
    setEditorEpoch((n) => n + 1)
    // Remount editors / presets when switching particles only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slot.id
  }, [slot.id])

  const persist = useCallback(
    (draft: AttrDraft) => {
      if (
        draft.htmlId.trim() === (slot.htmlId ?? '').trim() &&
        draft.cssClass.trim() === (slot.cssClass ?? '').trim() &&
        draft.particleCss === (slot.particleCss ?? '') &&
        draft.particleJs === (slot.particleJs ?? '')
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
      fd.set('particleCss', draft.particleCss)
      if (isDeveloperAdmin) fd.set('particleJs', draft.particleJs)

      startSave(async () => {
        const result = await updateSlotAttributesAction({}, fd)
        if (result.ok) {
          onAttrsSaved?.({
            htmlId: result.slotAttrs?.htmlId,
            cssClass: result.slotAttrs?.cssClass,
            particleCss: result.slotAttrs?.particleCss,
            particleJs: result.slotAttrs?.particleJs,
          })
          notifySaved('Saved')
          router.refresh()
        } else if (result.error) {
          notifyError(result.error)
        }
      })
    },
    [
      isDeveloperAdmin,
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
      slot.particleCss,
      slot.particleJs,
    ],
  )

  const { schedule, flush } = useDebouncedPersist(persist)

  const updateDraft = (partial: Partial<AttrDraft>) => {
    draftRef.current = { ...draftRef.current, ...partial }
    return draftRef.current
  }

  const setPreset = (groupId: LayoutCssPresetGroupId, value: string) => {
    const next = mergeCssClassFromParts({
      align: groupId === 'align' ? value : readPresetFromCssClass(cssClass, 'align'),
      padding: groupId === 'padding' ? value : readPresetFromCssClass(cssClass, 'padding'),
      margin: groupId === 'margin' ? value : readPresetFromCssClass(cssClass, 'margin'),
      custom: customClass,
    })
    setCssClass(next)
    flush('attrs', updateDraft({ cssClass: next }))
  }

  const setCustom = (nextCustom: string) => {
    setCustomClass(nextCustom)
    const next = mergeCssClassFromParts({
      align: readPresetFromCssClass(cssClass, 'align'),
      padding: readPresetFromCssClass(cssClass, 'padding'),
      margin: readPresetFromCssClass(cssClass, 'margin'),
      custom: nextCustom,
    })
    setCssClass(next)
    return updateDraft({ cssClass: next })
  }

  return (
    <div className="gantry-typed-form gantry-particle-attrs">
      <p className="settings-hint" style={{ margin: '0 0 0.35rem' }}>
        {showCodeEditors
          ? 'Block attributes — presets apply built-in utility classes; CSS / JS inject on this particle wrapper.'
          : 'Block attributes — presets apply built-in utility classes on this particle wrapper.'}
      </p>
      <div className="gantry-typed-row">
        <label>
          <span>HTML id</span>
          <input
            type="text"
            key={`htmlId-${slot.id}`}
            defaultValue={slot.htmlId ?? ''}
            placeholder="optional"
            spellCheck={false}
            autoComplete="off"
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
      </div>

      <div className="gantry-particle-presets">
        {LAYOUT_CSS_PRESET_GROUPS.map((group) => (
          <label key={group.id} className="gantry-particle-preset-field">
            <span>{group.label}</span>
            <select
              value={readPresetFromCssClass(cssClass, group.id)}
              aria-label={group.label}
              onChange={(event) => setPreset(group.id, event.target.value)}
            >
              {group.options.map((opt) => (
                <option key={opt.value || `${group.id}-default`} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <label className="settings-field">
        <span>Extra CSS class</span>
        <input
          type="text"
          key={`cssClass-custom-${slot.id}`}
          value={customClass}
          placeholder="optional custom tokens"
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => schedule('attrs', setCustom(event.target.value))}
          onBlur={(event) => flush('attrs', setCustom(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              ;(event.target as HTMLInputElement).blur()
            }
          }}
        />
      </label>
      <p className="settings-hint">
        Combined classes: <code>{cssClass || '(none)'}</code>
      </p>

      {showCodeEditors ? (
        <>
          <CodeEditorField
            key={`particle-css-${slot.id}-${editorEpoch}`}
            label="Particle CSS"
            language="css"
            initialValue={draftRef.current.particleCss}
            initialHeight={140}
            hint="Injected as a &lt;style&gt; inside this particle column on the public site."
            onValueChange={(next) => schedule('attrs', updateDraft({ particleCss: next }))}
          />
          <div
            onBlur={() => flush('attrs', draftRef.current)}
            style={{ display: 'contents' }}
          />

          {isDeveloperAdmin ? (
            <CodeEditorField
              key={`particle-js-${slot.id}-${editorEpoch}`}
              label="Particle JS"
              language="javascript"
              initialValue={draftRef.current.particleJs}
              initialHeight={120}
              hint="Injected before </body> on the public site (developer-admin)."
              onValueChange={(next) => schedule('attrs', updateDraft({ particleJs: next }))}
            />
          ) : (
            <p className="settings-hint">
              Particle JS — developer-admin only
              {draftRef.current.particleJs.trim()
                ? ` (saved script kept, ${draftRef.current.particleJs.trim().length} chars).`
                : '.'}
            </p>
          )}
        </>
      ) : null}

      {pending ? <p className="gantry-field-hint">Saving…</p> : null}
    </div>
  )
}
