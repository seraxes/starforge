'use client'

import React, { useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'

import { quickRegisterAction } from '../actions'
import type { TierCapacityDisplayMode } from '../types'
import type { EventSignupStatus } from './event-card-model'
import type { PublicTicketTier } from './ticket-tier-model'

export type { PublicTicketTier }

function tierCardStyle(tier: PublicTicketTier): CSSProperties | undefined {
  const style: CSSProperties = {}
  if (tier.borderColor) style.borderColor = tier.borderColor
  if (tier.backgroundColor) style.backgroundColor = tier.backgroundColor
  return tier.borderColor || tier.backgroundColor ? style : undefined
}

function tierTitleStyle(tier: PublicTicketTier): CSSProperties | undefined {
  return tier.titleColor ? { color: tier.titleColor } : undefined
}

type Props = {
  tiers: PublicTicketTier[]
  eventId: string
  /** Locale-prefixed event path (`/en/events/slug`) — client appends `?tier=` + `#register`. */
  eventPath: string
  /** Locale-prefixed login path (`/en/login`) — client appends `?next=`. */
  loginPath: string
  capacityDisplay?: TierCapacityDisplayMode
  registrationOpen?: boolean
  signupStatus?: EventSignupStatus
}

function CapacityMeta({
  tier,
  mode,
}: {
  tier: PublicTicketTier
  mode: TierCapacityDisplayMode
}) {
  if (tier.soldOut) {
    return <p className="sf-event-ticket-type-meta settings-hint">Sold out</p>
  }
  if (typeof tier.capacity !== 'number') {
    return <p className="sf-event-ticket-type-meta settings-hint">Open</p>
  }

  const occupiedLine = `${tier.occupied} / ${tier.capacity}`
  const free =
    tier.remaining != null
      ? `${tier.remaining} free slot${tier.remaining === 1 ? '' : 's'}`
      : null

  if (mode === 'occupied_max') {
    return <p className="sf-event-ticket-type-meta settings-hint">{occupiedLine}</p>
  }
  if (mode === 'free') {
    return (
      <p className="sf-event-ticket-type-meta settings-hint">{free ?? occupiedLine}</p>
    )
  }

  return (
    <div className="sf-event-ticket-type-capacity">
      <p className="sf-event-ticket-type-meta settings-hint">{occupiedLine}</p>
      {free ? (
        <p className="sf-event-ticket-type-meta is-free settings-hint">{free}</p>
      ) : null}
    </div>
  )
}

function formHref(eventPath: string, tierId: string): string {
  const base = eventPath.split('?')[0] || eventPath
  return `${base}?tier=${encodeURIComponent(tierId)}#register`
}

function loginHref(loginPath: string, eventPath: string, tierId: string): string {
  const next = formHref(eventPath, tierId)
  const base = loginPath.split('?')[0] || loginPath
  return `${base}?next=${encodeURIComponent(next)}`
}

/**
 * Public ticket / faction area cards — one-click Register when profile is complete.
 */
export function EventTicketTypes({
  tiers,
  eventId,
  eventPath,
  loginPath,
  capacityDisplay = 'both',
  registrationOpen = true,
  signupStatus = 'none',
}: Props) {
  const router = useRouter()
  const [pendingTier, setPendingTier] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  if (tiers.length === 0) return null

  const alreadyIn = signupStatus === 'registered' || signupStatus === 'waitlisted'

  function onRegister(tierId: string) {
    setError(null)
    setFeedback(null)
    setPendingTier(tierId)
    startTransition(async () => {
      try {
        const result = await quickRegisterAction(eventId, tierId)
        if (result.needsAuth) {
          router.push(loginHref(loginPath, eventPath, tierId))
          return
        }
        if (result.needsForm) {
          router.push(formHref(eventPath, tierId))
          return
        }
        if (result.error) {
          setError(result.error)
          return
        }
        setFeedback(result.message || 'Registered.')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not register.')
      } finally {
        setPendingTier(null)
      }
    })
  }

  return (
    <section className="sf-event-ticket-types" aria-label="Ticket types">
      <h2 className="sf-event-detail-section-heading">Ticket types</h2>
      {feedback ? (
        <p className="sf-event-ticket-types-feedback" role="status">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="sf-event-ticket-types-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="sf-event-ticket-types-list">
        {tiers.map((tier) => {
          const busy = isPending && pendingTier === tier.id
          const disabled =
            !registrationOpen ||
            tier.soldOut ||
            alreadyIn ||
            (isPending && pendingTier !== null)
          return (
            <li
              key={tier.id}
              className={`sf-event-ticket-type${tier.soldOut ? ' is-sold-out' : ''}${
                alreadyIn ? ' is-registered' : ''
              }`}
              style={tierCardStyle(tier)}
            >
              <div className="sf-event-ticket-type-head">
                <h3 className="sf-event-ticket-type-title" style={tierTitleStyle(tier)}>
                  {tier.title}
                </h3>
                {tier.priceLabel.trim() ? (
                  <p className="sf-event-ticket-type-price">{tier.priceLabel.trim()}</p>
                ) : null}
              </div>
              {tier.kind === 'faction' ? (
                <p className="sf-event-ticket-type-kind settings-hint">Faction</p>
              ) : null}
              {tier.shortDescription.trim() ? (
                <p className="sf-event-ticket-type-desc">{tier.shortDescription.trim()}</p>
              ) : null}
              <CapacityMeta tier={tier} mode={capacityDisplay} />
              <div className="sf-event-ticket-type-cta">
                {alreadyIn ? (
                  <span className="settings-hint">
                    {signupStatus === 'waitlisted' ? 'Waitlisted' : 'Already registered'}
                  </span>
                ) : !registrationOpen ? (
                  <span className="settings-hint">Registration closed</span>
                ) : tier.soldOut ? (
                  <span className="settings-hint">Sold out</span>
                ) : (
                  <button
                    type="button"
                    className="sf-event-ticket-type-register"
                    disabled={disabled}
                    onClick={() => onRegister(tier.id)}
                  >
                    {busy ? 'Registering…' : 'Register'}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
