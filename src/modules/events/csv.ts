/**
 * CSV helpers for Events registrant export.
 * Pure / client-safe — no DB imports.
 */

export type RegistrantCsvRow = {
  name: string
  email: string
  ticketType: string
  guests: number
  status: string
  /** Formatted money when the row has a payments order; otherwise empty. */
  paidAmount: string
}

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

export type RegistrantsCsvOptions = {
  rows: RegistrantCsvRow[]
  /** Include UTF-8 BOM for Excel. Default true. */
  bom?: boolean
}

/**
 * Build a CSV string for one event’s registrants.
 * Columns: name, email, ticket type, guests, status, paid amount
 */
export function buildRegistrantsCsv(options: RegistrantsCsvOptions): string {
  const { rows, bom = true } = options
  const header = csvRow([
    'name',
    'email',
    'ticket type',
    'guests',
    'status',
    'paid amount',
  ])
  const lines = [header]
  for (const row of rows) {
    lines.push(
      csvRow([
        row.name,
        row.email,
        row.ticketType,
        String(row.guests),
        row.status,
        row.paidAmount,
      ]),
    )
  }
  const body = lines.join('\r\n') + '\r\n'
  return bom ? `\uFEFF${body}` : body
}
