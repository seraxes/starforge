'use client'

import React from 'react'
import Link from 'next/link'

import { MediaPicker } from '@/modules/media/api'
import { RichEditor } from '@/modules/rich-editor/api'

export type EmailTemplateFormRow = {
  label?: string
  moduleCategory?: string
  subject?: string
  bodyText?: string
  bodyHtml?: string
}

type Props = {
  row?: EmailTemplateFormRow
  categories: string[]
  defaultCategory?: string
  busy?: boolean
  richEditorEnabled: boolean
  /** Hide label/category on the mosaic when those live in the details dialog. */
  hideIdentity?: boolean
  /**
   * When false, Message / HTML use half-width mosaic cards (campaigns list expand).
   * Full-page template editor keeps wide sections (default).
   */
  wideSections?: boolean
}

function EmailBodyHtmlField({
  defaultValue = '',
  disabled,
  richEditorEnabled,
}: {
  defaultValue?: string
  disabled?: boolean
  richEditorEnabled: boolean
}) {
  if (!richEditorEnabled) {
    return (
      <div className="settings-field settings-field-wide">
        <span>Body (HTML, optional)</span>
        <p className="admin-inline-error" role="alert">
          Rich editor is required for HTML email bodies. Enable it under{' '}
          <Link href="/admin/rich-editor/settings">Site Settings → Modules → Rich editor</Link>.
        </p>
        {/* Preserve existing HTML on save until rich-editor is enabled again. */}
        <input type="hidden" name="bodyHtml" value={defaultValue} readOnly />
      </div>
    )
  }

  return (
    <div className="settings-field settings-field-wide">
      <RichEditor
        name="bodyHtml"
        label="Body (HTML, optional)"
        defaultValue={defaultValue}
        disabled={disabled}
        enabled
        preset="email"
        placeholder="Optional email-safe HTML body…"
        MediaPicker={MediaPicker}
      />
      <p className="settings-hint">
        Email-safe TipTap (lists, links, images). No video, gallery, or web-only blocks.
      </p>
    </div>
  )
}

/** Identity fields — label + module category (list dialog or editor details popup). */
export function EmailTemplateIdentityFields({
  row,
  categories,
  defaultCategory = 'forms',
  busy,
}: {
  row?: EmailTemplateFormRow
  categories: string[]
  defaultCategory?: string
  busy?: boolean
}) {
  return (
    <>
      <label className="settings-field">
        <span>Label</span>
        <input
          type="text"
          name="label"
          defaultValue={row?.label ?? ''}
          required
          maxLength={200}
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <label className="settings-field">
        <span>Module category</span>
        <select
          name="moduleCategory"
          defaultValue={row?.moduleCategory ?? defaultCategory}
          disabled={busy}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}

/** Mosaic fieldsets for the full-page template editor (Events chrome). */
export function EmailTemplateFormFields({
  row,
  categories,
  defaultCategory = 'forms',
  busy,
  richEditorEnabled,
  hideIdentity = false,
  wideSections = true,
}: Props) {
  const sectionClass = wideSections
    ? 'settings-fieldset sf-events-form-section sf-events-form-section-wide'
    : 'settings-fieldset sf-events-form-section'

  return (
    <>
      {hideIdentity ? null : (
        <fieldset className="settings-fieldset sf-events-form-section">
          <legend>Details</legend>
          <EmailTemplateIdentityFields
            row={row}
            categories={categories}
            defaultCategory={defaultCategory}
            busy={busy}
          />
        </fieldset>
      )}

      <fieldset className={sectionClass}>
        <legend>Message</legend>
        <label className="settings-field">
          <span>Subject</span>
          <input
            type="text"
            name="subject"
            defaultValue={row?.subject ?? ''}
            required
            maxLength={500}
            placeholder="[Site] {{formTitle}}"
            autoComplete="off"
            disabled={busy}
          />
        </label>
        <label className="settings-field">
          <span>Body (text)</span>
          <textarea
            name="bodyText"
            rows={8}
            defaultValue={row?.bodyText ?? ''}
            placeholder={'Form: {{formTitle}}\n\n{{payloadText}}'}
            required
            disabled={busy}
          />
          <span className="settings-hint">
            Plain-text fallback. Merge fields use <code>{'{{name}}'}</code>.
          </span>
        </label>
      </fieldset>

      <fieldset className={sectionClass}>
        <legend>HTML body</legend>
        <EmailBodyHtmlField
          defaultValue={row?.bodyHtml ?? ''}
          disabled={busy}
          richEditorEnabled={richEditorEnabled}
        />
      </fieldset>
    </>
  )
}
