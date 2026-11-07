/**
 * Public ticket-tier view models (capacity + sold-out) for event pages / signup.
 */

import 'server-only'

import {
  countRegisteredGuestsForTier,
  listTicketTiersForEvent,
} from './tiers'
import type { PublicTicketTier } from './public/EventTicketTypes'

export type { PublicTicketTier }

export async function listPublicTicketTiersForEvent(
  eventId: string,
): Promise<PublicTicketTier[]> {
  const tiers = await listTicketTiersForEvent(eventId)
  return Promise.all(
    tiers.map(async (tier) => {
      const occupied =
        typeof tier.capacity === 'number'
          ? await countRegisteredGuestsForTier(eventId, tier.id)
          : 0
      const remaining =
        typeof tier.capacity === 'number'
          ? Math.max(0, tier.capacity - occupied)
          : null
      const soldOut = remaining === 0
      return {
        id: tier.id,
        title: tier.title,
        description: tier.description,
        kind: tier.kind,
        priceLabel: tier.priceLabel,
        capacity: tier.capacity,
        occupied: typeof tier.capacity === 'number' ? occupied : 0,
        remaining,
        soldOut,
      }
    }),
  )
}
