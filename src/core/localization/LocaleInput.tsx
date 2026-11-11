'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { AdminConfirmDialog } from '@/components/admin/AdminConfirmDialog'
import type { ContentLocaleOption } from '@/core/i18n/locale-text'

import { isMultilangEnabled } from './multilang'

type Props = {
  locales: ContentLocaleOption[]
  values: Record<string, string>
  label: string
  requiredDefault?: boolean
  onChange: (code: string, value: string) => void
  onBlur?: () => void
}

/** Floppy / save disk — Copy from another locale. */
function CopyDiskIcon() {
  return (
    <svg
      className="sf-locale-input-copy-disk-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5V4.207a1.5 1.5 0 0 0-.44-1.06L12.853 1.44A1.5 1.5 0 0 0 11.793 1H2.5zm2 1h5v3.5a.5.5 0 0 1-.5.5h-4a.5.5 0 0 1-.5-.5V2zm6 0h.793L14 4.207V5.5a.5.5 0 0 1-.5.5H11a.5.5 0 0 1-.5-.5V2zM3 9.5A1.5 1.5 0 0 1 4.5 8h7A1.5 1.5 0 0 1 13 9.5v3a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-3z"
      />
    </svg>
  )
}

/**
 * One text field. When Localization has more than one public locale, a language
 * menu sticks to the end of the input and a Copy-from menu fills the current
 * language from another. With a single locale this is an ordinary field.
 */
export function LocaleInput({
  locales,
  values,
  label,
  requiredDefault = false,
  onChange,
  onBlur,
}: Props) {
  const multilang = isMultilangEnabled(locales)
  const fallback = locales.find((locale) => locale.isDefault) ?? locales[0]
  const [active, setActive] = useState(fallback?.code ?? '')

  useEffect(() => {
    if (!fallback) return
    if (!locales.some((locale) => locale.code === active)) setActive(fallback.code)
  }, [locales, active, fallback])

  if (!fallback) return null
  const code = multilang ? active || fallback.code : fallback.code

  return (
    <label className="settings-field">
      <span>{label}</span>
      <span className="sf-locale-input">
        <input
          type="text"
          value={values[code] ?? ''}
          required={requiredDefault && code === fallback.code}
          onChange={(event) => onChange(code, event.target.value)}
          onBlur={onBlur}
        />
        {multilang ? (
          <LocaleLanguageControl
            locales={locales}
            active={code}
            label={label}
            onActiveChange={setActive}
            onCopyFrom={(fromCode) => onChange(code, values[fromCode] ?? '')}
          />
        ) : null}
      </span>
    </label>
  )
}

/** Language menu for a field Localization does not render itself (code editors). */
export function LocaleLanguageControl({
  locales,
  active,
  label,
  onActiveChange,
  onCopyFrom,
}: {
  locales: ContentLocaleOption[]
  active: string
  label: string
  onActiveChange: (code: string) => void
  onCopyFrom?: (fromCode: string) => void
}) {
  const [pendingFrom, setPendingFrom] = useState<string | null>(null)
  const selectWidth = useMemo(() => {
    const longest = locales.reduce((max, locale) => Math.max(max, locale.code.length), 2)
    // Code + settings-field left pad (0.75rem) + chevron gutter (2.25rem) + hairline.
    return `calc(${Math.max(longest, 2)}ch + 3.25rem)`
  }, [locales])

  if (!isMultilangEnabled(locales)) return null

  const pendingLocale = pendingFrom
    ? locales.find((locale) => locale.code === pendingFrom)
    : undefined

  return (
    <span
      className="sf-locale-input-tools"
      onClick={(event) => {
        // Keep select / copy hits from also activating the wrapping settings-field label.
        event.stopPropagation()
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <select
        className="sf-locale-input-locale"
        aria-label={`${label} language`}
        value={active}
        style={{ ['--sf-locale-select-w' as string]: selectWidth }}
        onChange={(event) => onActiveChange(event.target.value)}
      >
        {locales.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.code}
          </option>
        ))}
      </select>
      {onCopyFrom ? (
        <span className="sf-locale-input-copy-wrap" title="Copy from another language">
          <span className="sf-locale-input-copy-label">Copy from</span>
          <span className="sf-locale-input-copy-face" aria-hidden="true">
            <CopyDiskIcon />
          </span>
          <select
            className="sf-locale-input-copy"
            aria-label={`${label} copy from language`}
            value=""
            onChange={(event) => {
              const fromCode = event.target.value
              event.target.value = ''
              if (!fromCode || fromCode === active) return
              setPendingFrom(fromCode)
            }}
          >
            <option value="">Copy from…</option>
            {locales.map((locale) => (
              <option key={locale.code} value={locale.code} disabled={locale.code === active}>
                {locale.code}
              </option>
            ))}
          </select>
        </span>
      ) : null}
      <AdminConfirmDialog
        open={Boolean(pendingLocale)}
        title="Copy translation?"
        message={
          pendingLocale
            ? `Replace the current ${active} content with the ${pendingLocale.code} version? This cannot be undone from here.`
            : ''
        }
        confirmLabel="Copy"
        cancelLabel="Cancel"
        danger
        onCancel={() => setPendingFrom(null)}
        onConfirm={() => {
          if (pendingFrom && pendingFrom !== active) onCopyFrom?.(pendingFrom)
          setPendingFrom(null)
        }}
      />
    </span>
  )
}
