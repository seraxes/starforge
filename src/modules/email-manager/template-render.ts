/**
 * Lightweight merge: `{{path}}` / `{{ path }}` resolved against a flat+nested payload.
 * Unresolved tokens stay as empty string (soft). No HTML escaping here — callers
 * choose text vs html bodies; do not pipe untrusted HTML into html without care.
 */

import { resolvePayloadPath } from './conditions'

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g

function valueToMergeString(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value.map(valueToMergeString).filter(Boolean).join(', ')
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return ''
    }
  }
  return ''
}

export function renderEmailTemplateString(
  source: string,
  payload: Record<string, unknown>,
): string {
  if (!source) return ''
  return source.replace(TOKEN_RE, (_full, path: string) => {
    const resolved = resolvePayloadPath(payload, path)
    return valueToMergeString(resolved)
  })
}

export function renderEmailTemplate(options: {
  subject: string
  bodyText: string
  bodyHtml?: string
  payload: Record<string, unknown>
}): { subject: string; text: string; html?: string } {
  const subject = renderEmailTemplateString(options.subject, options.payload).trim()
  const text = renderEmailTemplateString(options.bodyText, options.payload)
  const htmlSource = (options.bodyHtml || '').trim()
  const html = htmlSource
    ? renderEmailTemplateString(htmlSource, options.payload)
    : undefined
  return { subject: subject || '(no subject)', text, html }
}

/** Extract unique merge-field paths referenced in subject/bodies (admin help). */
export function listMergeFieldsInTemplate(parts: {
  subject?: string
  bodyText?: string
  bodyHtml?: string
}): string[] {
  const found = new Set<string>()
  for (const src of [parts.subject, parts.bodyText, parts.bodyHtml]) {
    if (!src) continue
    for (const match of src.matchAll(TOKEN_RE)) {
      const path = match[1]?.trim()
      if (path) found.add(path)
    }
  }
  return [...found].sort((a, b) => a.localeCompare(b))
}
