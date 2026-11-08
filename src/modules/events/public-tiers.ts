/**
 * Public ticket-tier view models (capacity + sold-out) for event pages / signup.
 */

import 'server-only'

import { formatTierPriceDisplay } from './price-display'
import { findEventById } from './store'
import {
  countRegisteredGuestsForTier,
  effectiveMaxTicketsPerBooking,
  listTicketTiersForEvent,
} from './tiers'
import type { PublicTicketTier } from './public/ticket-tier-model'

export type { PublicTicketTier }

function cardBlurb(shortDescription: string, description: string): string {
  const short = shortDescription.trim()
  if (short) return short
  const full = description.trim()
  if (full.length <= 180) return full
  return `${full.slice(0, 177).trimEnd()}…`
}

export async function listPublicTicketTiersForEvent(
  eventId: string,
): Promise<PublicTicketTier[]> {
  const [tiers, event] = await Promise.all([
    listTicketTiersForEvent(eventId),
    findEventById(eventId),
  ])
  const waitlistEnabled = event?.waitlistEnabled !== false
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
        shortDescription: cardBlurb(tier.shortDescription, tier.description),
        description: tier.description,
        kind: tier.kind,
        price: tier.price,
        priceModifier: tier.priceModifier,
        priceLabel: formatTierPriceDisplay({
          price: tier.price,
          priceModifier: tier.priceModifier,
          priceLabel: tier.priceLabel,
        }),
        titleColor: tier.titleColor,
        borderColor: tier.borderColor,
        backgroundColor: tier.backgroundColor,
        capacity: tier.capacity,
        maxPerBooking: effectiveMaxTicketsPerBooking(tier.maxPerBooking),
        occupied: typeof tier.capacity === 'number' ? occupied : 0,
        remaining,
        soldOut,
        waitlistEnabled,
      }
    }),
  )
}
