/**
 * Server-side Events registrant CSV assembly (admin export).
 */

import 'server-only'

import { formatMoneyMinor, getOrderGrossByIds } from '@/modules/payments/api'

import { buildRegistrantsCsv, type RegistrantCsvRow } from './csv'
import { listRegistrationsForEvent } from './registrations'
import { findEventById } from './store'
import { listTicketTiersForEvent } from './tiers'

export type BuildEventRegistrantsCsvResult =
  | { ok: true; csv: string; filename: string; eventTitle: string }
  | { ok: false; error: string; status: 400 | 404 }

/**
 * Build CSV for one event’s registrant list (same rows/statuses as admin list).
 */
export async function buildEventRegistrantsCsv(
  eventId: string,
): Promise<BuildEventRegistrantsCsvResult> {
  const trimmed = eventId.trim()
  if (!trimmed) {
    return { ok: false, error: 'eventId query parameter is required.', status: 400 }
  }

  const event = await findEventById(trimmed)
  if (!event) {
    return { ok: false, error: 'Event not found.', status: 404 }
  }

  const [registrations, tiers] = await Promise.all([
    listRegistrationsForEvent(trimmed, { includeCancelled: true }),
    listTicketTiersForEvent(trimmed),
  ])

  const tierTitle = new Map(tiers.map((t) => [t.id, t.title]))
  const orderIds = registrations
    .map((r) => r.paymentOrderId)
    .filter((id) => id.length > 0)
  const orderGross = await getOrderGrossByIds(orderIds)

  const rows: RegistrantCsvRow[] = registrations.map((r) => {
    let paidAmount = ''
    if (r.paymentOrderId) {
      const snap = orderGross.get(r.paymentOrderId)
      if (snap) {
        paidAmount = formatMoneyMinor(snap.totalGrossMinor, snap.currency)
      }
    }
    return {
      name: r.name,
      email: r.email,
      ticketType: r.ticketTierId
        ? tierTitle.get(r.ticketTierId) || r.ticketTierId
        : '',
      guests: r.guests,
      status: r.status,
      paidAmount,
    }
  })

  const csv = buildRegistrantsCsv({ rows })
  const safeSlug =
    (event.slug || event.id).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 64) ||
    'event'
  const filename = `event-${safeSlug}-registrants.csv`

  return { ok: true, csv, filename, eventTitle: event.title }
}
