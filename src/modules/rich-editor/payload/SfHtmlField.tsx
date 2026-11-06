'use client'

import type { TextareaFieldClientComponent } from 'payload'
import { FieldLabel, useField } from '@payloadcms/ui'
import React from 'react'

import { sanitizeRichHtml } from '@/core/rich-editor/sanitize'
import { RichEditor } from '@/modules/rich-editor/api'

/**
 * Payload admin field — TipTap Visual/HTML over a localized textarea (HTML string).
 */
export const SfHtmlField: TextareaFieldClientComponent = (props) => {
  const { field, path, readOnly } = props
  const fieldPath = path || ('name' in field ? String(field.name) : 'body')
  const { value, setValue } = useField<string>({ path: fieldPath })
  const rawLabel = 'label' in field ? field.label : 'Content'
  const label =
    typeof rawLabel === 'string'
      ? rawLabel
      : rawLabel && typeof rawLabel === 'object' && rawLabel !== null && 'en' in rawLabel
        ? String((rawLabel as { en?: string }).en || 'Content')
        : 'Body'

  return (
    <div className="field-type sf-html-field">
      <FieldLabel
        label={label}
        path={fieldPath}
        required={'required' in field ? Boolean(field.required) : false}
      />
      <RichEditor
        value={typeof value === 'string' ? value : ''}
        onChange={(html) => setValue(sanitizeRichHtml(html))}
        disabled={Boolean(readOnly)}
        enabled
        preset="full"
        placeholder="Page body…"
      />
    </div>
  )
}

export default SfHtmlField
