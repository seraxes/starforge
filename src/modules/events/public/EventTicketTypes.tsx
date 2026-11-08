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

/** Top-right booked / max (∞ when unlimited). */
function BookedMax({ tier }: { tier: PublicTicketTier }) {
  const max =
    typeof tier.capacity === 'number' ? String(tier.capacity) : '∞'
  const label = `${tier.occupied}/${max}`
  return (
    <p
      className="sf-event-ticket-type-booked"
      title="Booked / max"
      aria-label={`${tier.occupied} booked of ${max === '∞' ? 'unlimited' : max}`}
    >
      {label}
    </p>
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
          const canWaitlist = tier.soldOut && tier.waitlistEnabled
          const disabled =
            !registrationOpen ||
            (tier.soldOut && !tier.waitlistEnabled) ||
            alreadyIn ||
            (isPending && pendingTier !== null)
          return (
            <li
              key={tier.id}
              className={`sf-event-ticket-type${
                tier.kind === 'faction' ? ' is-faction' : ''
              }${tier.soldOut ? ' is-sold-out' : ''}${
                alreadyIn ? ' is-registered' : ''
              }`}
              style={tierCardStyle(tier)}
            >
              <div className="sf-event-ticket-type-head">
                <h3 className="sf-event-ticket-type-title" style={tierTitleStyle(tier)}>
                  {tier.title}
                </h3>
                <BookedMax tier={tier} />
              </div>
              {tier.kind === 'faction' ? (
                <p className="sf-event-ticket-type-kind settings-hint">Faction</p>
              ) : null}
              {tier.shortDescription.trim() ? (
                <p className="sf-event-ticket-type-desc">{tier.shortDescription.trim()}</p>
              ) : null}
              {tier.priceLabel.trim() ? (
                <p className="sf-event-ticket-type-price">{tier.priceLabel.trim()}</p>
              ) : null}
              {capacityDisplay === 'free' &&
              !tier.soldOut &&
              typeof tier.capacity === 'number' &&
              tier.remaining != null ? (
                <p className="sf-event-ticket-type-meta is-free settings-hint">
                  {tier.remaining} free slot{tier.remaining === 1 ? '' : 's'}
                </p>
              ) : null}
              <div className="sf-event-ticket-type-cta">
                {alreadyIn ? (
                  <span className="settings-hint">
                    {signupStatus === 'waitlisted' ? 'Waitlisted' : 'Already registered'}
                  </span>
                ) : !registrationOpen ? (
                  <span className="settings-hint">Registration closed</span>
                ) : tier.soldOut && !tier.waitlistEnabled ? (
                  <span className="settings-hint">Sold out</span>
                ) : (
                  <button
                    type="button"
                    className={`sf-event-ticket-type-register${
                      canWaitlist ? ' is-waitlist' : ''
                    }`}
                    disabled={disabled}
                    onClick={() => onRegister(tier.id)}
                  >
                    {busy
                      ? canWaitlist
                        ? 'Joining…'
                        : 'Registering…'
                      : canWaitlist
                        ? 'Join waitlist'
                        : 'Register'}
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
