/**
 * CSV helpers for Form submissions export (SF-133).
 * Pure / client-safe — no DB imports.
 */

import type { FormFieldDef, FormSubmissionRecord } from './types'

/** Escape one CSV cell (RFC 4180-ish). */
export function escapeCsvCell(value: string): string {
  const s = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function csvRow(cells: string[]): string {
  return cells.map(escapeCsvCell).join(',')
}

/** Flatten a jsonb submission cell for CSV (arrays → `; `-joined). */
export function formatCsvPayloadCell(
  value: string | string[] | number | boolean | null | undefined,
): string {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(String).join('; ')
  return String(value)
}

/**
 * Ordered payload column keys: definition field names first (when provided),
 * then any extra keys seen in submissions (stable alpha).
 */
export function collectCsvPayloadKeys(
  submissions: FormSubmissionRecord[],
  fields?: FormFieldDef[],
): string[] {
  const seen = new Set<string>()
  const ordered: string[] = []
  if (fields?.length) {
    for (const f of fields) {
      if (!f.name || seen.has(f.name)) continue
      seen.add(f.name)
      ordered.push(f.name)
    }
  }
  const extras = new Set<string>()
  for (const row of submissions) {
    for (const key of Object.keys(row.payload)) {
      if (!seen.has(key)) extras.add(key)
    }
  }
  for (const key of [...extras].sort()) {
    ordered.push(key)
  }
  return ordered
}

export type FormSubmissionsCsvOptions = {
  submissions: FormSubmissionRecord[]
  /** Prefer definition field order when exporting a single form. */
  fields?: FormFieldDef[]
  /** Include UTF-8 BOM for Excel. Default true. */
  bom?: boolean
}

/**
 * Build a CSV string: meta columns + payload keys.
 * Meta: id, createdAt, formKey, definitionId, ipAddress
 */
export function buildFormSubmissionsCsv(options: FormSubmissionsCsvOptions): string {
  const { submissions, fields, bom = true } = options
  const payloadKeys = collectCsvPayloadKeys(submissions, fields)
  const header = csvRow([
    'id',
    'createdAt',
    'formKey',
    'definitionId',
    'ipAddress',
    ...payloadKeys,
  ])
  const lines = [header]
  for (const row of submissions) {
    lines.push(
      csvRow([
        row.id,
        row.createdAt.toISOString(),
        row.formKey,
        row.definitionId ?? '',
        row.ipAddress ?? '',
        ...payloadKeys.map((k) => formatCsvPayloadCell(row.payload[k])),
      ]),
    )
  }
  const body = lines.join('\r\n') + '\r\n'
  return bom ? `\uFEFF${body}` : body
}

/**
 * Sanitize optional success redirect — relative site paths only (open-redirect safe).
 * Allows `/thanks` and `/app/foo?x=1#y`; rejects protocol-relative and absolute URLs.
 */
export function normalizeSuccessRedirectUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined
  if (!trimmed.startsWith('/')) return undefined
  if (trimmed.startsWith('//')) return undefined
  if (trimmed.includes('\\')) return undefined
  // Block scheme-ish paths like `/http:evil`
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(trimmed)) return undefined
  if (trimmed.length > 2048) return undefined
  return trimmed
}
