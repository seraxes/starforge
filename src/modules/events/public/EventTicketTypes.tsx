import React from 'react'

import type { TicketTierKind } from '../types'

export type PublicTicketTier = {
  id: string
  title: string
  description: string
  kind: TicketTierKind
  priceLabel: string
  capacity: number | null
  occupied: number
  remaining: number | null
  soldOut: boolean
}

type Props = {
  tiers: PublicTicketTier[]
  /** Anchor target for “Register” CTA (default `#register`). */
  registerHref?: string
}

/**
 * EB-style ticket types block on the public event page — marketing copy above signup.
 */
export function EventTicketTypes({ tiers, registerHref = '#register' }: Props) {
  if (tiers.length === 0) return null

  return (
    <section className="sf-event-ticket-types" aria-label="Ticket types">
      <h2 className="sf-event-detail-section-heading">Ticket types</h2>
      <ul className="sf-event-ticket-types-list">
        {tiers.map((tier) => (
          <li
            key={tier.id}
            className={`sf-event-ticket-type${tier.soldOut ? ' is-sold-out' : ''}`}
          >
            <div className="sf-event-ticket-type-head">
              <h3 className="sf-event-ticket-type-title">{tier.title}</h3>
              {tier.priceLabel.trim() ? (
                <p className="sf-event-ticket-type-price">{tier.priceLabel.trim()}</p>
              ) : null}
            </div>
            {tier.kind === 'faction' ? (
              <p className="sf-event-ticket-type-kind settings-hint">Faction slot</p>
            ) : null}
            {tier.description.trim() ? (
              <p className="sf-event-ticket-type-desc">{tier.description.trim()}</p>
            ) : null}
            <p className="sf-event-ticket-type-meta settings-hint">
              {tier.soldOut
                ? 'Sold out'
                : tier.remaining != null
                  ? `${tier.remaining} seat${tier.remaining === 1 ? '' : 's'} left`
                  : typeof tier.capacity === 'number'
                    ? `${tier.occupied}/${tier.capacity}`
                    : 'Open'}
            </p>
            {!tier.soldOut ? (
              <p className="sf-event-ticket-type-cta">
                <a href={registerHref}>Register with this ticket</a>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
