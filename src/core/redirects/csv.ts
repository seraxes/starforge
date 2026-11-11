/**
 * Redirects CSV import helpers (slice 2). Redirects-only — not a generic importer.
 * Header: from,to,status,enabled,note
 */

import { normalizeRedirectFromPath, normalizeRedirectToPath } from './paths'
import {
  isRedirectStatusCode,
  type RedirectStatusCode,
} from './types'

export type RedirectCsvRowInput = {
  fromPath: string
  toPath: string
  statusCode: RedirectStatusCode
  enabled: boolean
  note: string
}

const REQUIRED_HEADERS = ['from', 'to', 'status', 'enabled', 'note'] as const

/** Split one CSV line into cells (RFC 4180-ish quotes). */
export function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      cells.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  cells.push(cur)
  return cells
}

/** Split CSV text into non-empty logical lines (handles quoted newlines). */
export function splitCsvLines(text: string): string[] {
  const raw = text.replace(/^\uFEFF/, '')
  const lines: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!
    if (ch === '"') {
      inQuotes = !inQuotes
      cur += ch
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && raw[i + 1] === '\n') i++
      if (cur.trim()) lines.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur.trim()) lines.push(cur)
  return lines
}

function headerIndexMap(headerCells: string[]): Map<string, number> | { error: string } {
  const map = new Map<string, number>()
  headerCells.forEach((cell, i) => {
    const key = cell.trim().toLowerCase()
    if (key) map.set(key, i)
  })
  for (const name of REQUIRED_HEADERS) {
    if (!map.has(name)) {
      return {
        error: `CSV header must include columns: ${REQUIRED_HEADERS.join(',')}.`,
      }
    }
  }
  return map
}

function cellAt(cells: string[], index: number | undefined): string {
  if (index === undefined) return ''
  return (cells[index] ?? '').trim()
}

/** Parse enabled cell: empty → true (same default as create). */
export function parseRedirectCsvEnabled(raw: string): boolean | { error: string } {
  const v = raw.trim().toLowerCase()
  if (!v) return true
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false
  return { error: `Invalid enabled value “${raw.trim()}”.` }
}

/**
 * Parse status cell. Empty → 301 (create default).
 * Non-empty invalid codes are errors (skipped by import).
 */
export function parseRedirectCsvStatus(
  raw: string,
): RedirectStatusCode | { error: string } {
  const v = raw.trim()
  if (!v) return 301
  const n = Number(v)
  if (!isRedirectStatusCode(n)) {
    return { error: `Invalid status “${v}” (use 301, 302, 307, or 308).` }
  }
  return n
}

/**
 * Validate one CSV data row with the same path rules as createRedirect.
 * Bad status / enabled / paths → error (caller skips).
 */
export function validateRedirectCsvRow(raw: {
  from: string
  to: string
  status: string
  enabled: string
  note: string
}): RedirectCsvRowInput | { error: string } {
  const fromPath = normalizeRedirectFromPath(raw.from)
  const toPath = normalizeRedirectToPath(raw.to)
  if (!fromPath) return { error: 'From path is required (e.g. /old-page).' }
  if (!toPath) return { error: 'To path is required (e.g. /new-page or https://…).' }
  if (fromPath === toPath) return { error: 'From and to must be different.' }

  const statusCode = parseRedirectCsvStatus(raw.status)
  if (typeof statusCode === 'object') return statusCode

  const enabled = parseRedirectCsvEnabled(raw.enabled)
  if (typeof enabled === 'object') return enabled

  const note = (raw.note || '').trim().slice(0, 200)
  return { fromPath, toPath, statusCode, enabled, note }
}

export type ParseRedirectCsvResult =
  | { rows: RedirectCsvRowInput[]; skipped: number }
  | { error: string }

/**
 * Parse a redirects CSV. Invalid data rows are omitted and counted in `skipped`.
 * Header must name: from,to,status,enabled,note (order flexible).
 */
export function parseRedirectCsv(text: string): ParseRedirectCsvResult {
  const lines = splitCsvLines(text)
  if (lines.length === 0) {
    return { error: 'CSV is empty.' }
  }

  const headerMap = headerIndexMap(splitCsvLine(lines[0]!))
  if ('error' in headerMap) return headerMap

  const fromIdx = headerMap.get('from')!
  const toIdx = headerMap.get('to')!
  const statusIdx = headerMap.get('status')!
  const enabledIdx = headerMap.get('enabled')!
  const noteIdx = headerMap.get('note')!

  const rows: RedirectCsvRowInput[] = []
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!)
    // Blank line already filtered; skip all-empty rows.
    if (cells.every((c) => !c.trim())) {
      skipped++
      continue
    }
    const parsed = validateRedirectCsvRow({
      from: cellAt(cells, fromIdx),
      to: cellAt(cells, toIdx),
      status: cellAt(cells, statusIdx),
      enabled: cellAt(cells, enabledIdx),
      note: cellAt(cells, noteIdx),
    })
    if ('error' in parsed) {
      skipped++
      continue
    }
    rows.push(parsed)
  }

  return { rows, skipped }
}
