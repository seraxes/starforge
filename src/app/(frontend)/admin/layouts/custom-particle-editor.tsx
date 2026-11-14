'use client'

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { CodeEditorField } from '@/components/admin/CodeEditorField'
import { normalizeLocaleTextMap } from '@/core/i18n/locale-text'
import { LocaleInput, LocaleLanguageControl } from '@/core/localization/LocaleInput'
import { updateSlotConfigAction } from '@/core/modules/actions'
import type { LayoutSlot, LayoutSlotConfig } from '@/core/modules/types'

import { useAdminToast } from '../admin-toast'
import { useDebouncedPersist } from '../use-debounced-persist'
import { useContentLocales } from './content-locales-context'
import { useLayoutOutlineId } from './layout-outline-context'
import { ParticleSettingsPopover } from './particle-settings-popover'

type CustomDraft = {
  title: string
  titleLocales: Record<string, string>
  html: string
  htmlLocales: Record<string, string>
  css: string
  js: string
}

function readCustomDraft(config: LayoutSlotConfig | undefined): CustomDraft {
  const cfg = config ?? {}
  return {
    title: String(cfg.title ?? ''),
    titleLocales: normalizeLocaleTextMap(cfg.titleLocales),
    html: String(cfg.html ?? ''),
    htmlLocales: normalizeLocaleTextMap(cfg.htmlLocales),
    css: String(cfg.css ?? ''),
    js: String(cfg.js ?? ''),
  }
}

/**
 * Custom particle — HTML / CSS / JS. Autosaves (Site Settings debounce) on edit; local title draft
 * stays stable across saves (no form remount / focus loss).
 *
 * CodeMirror is not a form control. Persist from a draft ref so the save cannot submit the
 * previous HTML (a hidden configJson is already stale when the editor calls save).
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
  const layoutId = useLayoutOutlineId()
  const { notifySaved, notifyError } = useAdminToast()
  const [pending, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const locales = useContentLocales()
  const defaultCode = locales.find((locale) => locale.isDefault)?.code ?? locales[0]?.code ?? ''
  const [draft, setDraft] = useState<CustomDraft>(() => readCustomDraft(slot.config))
  const [htmlLocale, setHtmlLocale] = useState(defaultCode)
  // Remount code editors only when switching particles — not after each autosave.
  const [editorEpoch, setEditorEpoch] = useState(0)
  const draftRef = useRef(draft)
  const slotIdRef = useRef(slot.id)
  if (slotIdRef.current !== slot.id) {
    slotIdRef.current = slot.id
    draftRef.current = readCustomDraft(slot.config)
  }

  useEffect(() => {
    const next = readCustomDraft(slot.config)
    draftRef.current = next
    setDraft(next)
    setHtmlLocale(defaultCode)
    setError(null)
    setEditorEpoch((n) => n + 1)
    // defaultCode is read when the particle changes; locale list updates must not wipe the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when switching slots
  }, [slot.id])

  const persist = useCallback(
    (payload: CustomDraft) => {
      const fd = new FormData()
      fd.set('layoutId', layoutId)
      fd.set('sectionId', sectionId)
      fd.set('rowId', rowId)
      fd.set('slotId', slot.id)
      fd.set('configJson', JSON.stringify(payload))

      startSave(async () => {
        const result = await updateSlotConfigAction({}, fd)
        if (result.ok) {
          setError(null)
          if (result.config) onConfigSaved?.(result.config)
          notifySaved(result.message || 'Saved')
        } else if (result.error) {
          setError(result.error)
          notifyError(result.error)
        }
      })
    },
    [layoutId, notifyError, notifySaved, onConfigSaved, rowId, sectionId, slot.id],
  )

  const { schedule, flush } = useDebouncedPersist(persist)

  const patchDraft = (partial: Partial<CustomDraft>) => {
    const next = { ...draftRef.current, ...partial }
    draftRef.current = next
    setDraft(next)
    return next
  }

  const scheduleSave = () => {
    schedule('custom', { ...draftRef.current })
  }

  const flushSave = () => {
    flush('custom', { ...draftRef.current })
  }

  const activeHtml =
    !defaultCode || htmlLocale === defaultCode
      ? draft.html
      : (draft.htmlLocales[htmlLocale] ?? '')

  const form = (
    <div className="gantry-custom-form">
      <LocaleInput
        locales={locales}
        label="Title"
        values={{
          ...draft.titleLocales,
          ...(defaultCode ? { [defaultCode]: draft.title } : {}),
        }}
        onChange={(code, value) => {
          patchDraft({
            titleLocales: { ...draftRef.current.titleLocales, [code]: value },
            ...(code === defaultCode ? { title: value } : {}),
          })
          scheduleSave()
        }}
        onBlur={flushSave}
      />

      <CodeEditorField
        key={`html-${slot.id}-${editorEpoch}-${htmlLocale}`}
        label="HTML"
        language="html"
        initialValue={activeHtml}
        initialHeight={180}
        placeholder="<p>Custom HTML</p>"
        labelEnd={
          <LocaleLanguageControl
            locales={locales}
            active={htmlLocale || defaultCode}
            label="HTML"
            onActiveChange={setHtmlLocale}
            onCopyFrom={(fromCode) => {
              const target = htmlLocale || defaultCode
              if (!target || fromCode === target) return
              const source =
                fromCode === defaultCode
                  ? draftRef.current.html
                  : (draftRef.current.htmlLocales[fromCode] ?? '')
              if (target === defaultCode) {
                patchDraft({
                  html: source,
                  htmlLocales: { ...draftRef.current.htmlLocales, [target]: source },
                })
              } else {
                patchDraft({
                  htmlLocales: { ...draftRef.current.htmlLocales, [target]: source },
                })
              }
              setEditorEpoch((n) => n + 1)
              scheduleSave()
            }}
          />
        }
        onValueChange={(value) => {
          if (!defaultCode || htmlLocale === defaultCode) {
            const code = defaultCode
            patchDraft({
              html: value,
              ...(code
                ? { htmlLocales: { ...draftRef.current.htmlLocales, [code]: value } }
                : {}),
            })
          } else {
            patchDraft({
              htmlLocales: { ...draftRef.current.htmlLocales, [htmlLocale]: value },
            })
          }
          scheduleSave()
        }}
      />
      <CodeEditorField
        key={`css-${slot.id}-${editorEpoch}`}
        label="CSS"
        language="css"
        initialValue={draft.css}
        initialHeight={140}
        placeholder=".my-block { color: … }"
        onValueChange={(value) => {
          patchDraft({ css: value })
          scheduleSave()
        }}
      />
      <CodeEditorField
        key={`js-${slot.id}-${editorEpoch}`}
        label="JavaScript"
        language="javascript"
        initialValue={draft.js}
        initialHeight={120}
        placeholder="// Stored only — execution gated to developer-admins later"
        hint="JS is saved on the slot but not executed in this foundation slice."
        onValueChange={(value) => {
          patchDraft({ js: value })
          scheduleSave()
        }}
      />

      {pending ? <p className="layout-muted">Saving…</p> : null}
      {error ? (
        <p className="admin-inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )

  if (embedded) return form
  return (
    <ParticleSettingsPopover title="Custom particle — HTML / CSS / JS">{form}</ParticleSettingsPopover>
  )
}
