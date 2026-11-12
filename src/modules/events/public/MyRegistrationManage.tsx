'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { cancelOwnRegistrationAction } from '../actions'
import { RegistrationTicketQr } from './RegistrationTicketQr'

type Props = {
  registrationId: string
  eventHref: string
  statusLabel: string
  tierTitle: string
  guests: number
  cancelOpen: boolean
  cancelClosedReason?: string
  cancelDeadlineLabel?: string
  canRequestRefund: boolean
  loginPath: string
  /** Confirmed seat — show door check-in QR. */
  showDoorQr?: boolean
  /** Absolute admin check-in URL for the QR payload. */
  checkInUrl?: string
  attendeeName?: string
}

/**
 * Signed-in attendee cancel form for the public my-registration page.
 */
export function MyRegistrationManage({
  registrationId,
  eventHref,
  statusLabel,
  tierTitle,
  guests,
  cancelOpen,
  cancelClosedReason,
  cancelDeadlineLabel,
  canRequestRefund,
  loginPath,
  showDoorQr = false,
  checkInUrl = '',
  attendeeName = '',
}: Props) {
  const router = useRouter()
  const [requestRefund, setRequestRefund] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onCancel() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await cancelOwnRegistrationAction(registrationId, {
          requestRefund: canRequestRefund && requestRefund,
        })
        if ('needsAuth' in result && result.needsAuth) {
          router.push(`${loginPath}?next=${encodeURIComponent(eventHref)}`)
          return
        }
        if ('error' in result && result.error) {
          setError(result.error)
          return
        }
        if ('ok' in result && result.ok) {
          const q = new URLSearchParams()
          q.set('cancelled', '1')
          if (result.refundMessage) q.set('refundNote', '1')
          router.push(`${eventHref}?${q.toString()}`)
          return
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not cancel.')
      }
    })
  }

  return (
    <section className="sf-event-my-registration" aria-label="My registration">
      <dl className="sf-event-my-registration-facts">
        <div>
          <dt>Status</dt>
          <dd>{statusLabel}</dd>
        </div>
        {tierTitle.trim() ? (
          <div>
            <dt>Ticket type</dt>
            <dd>{tierTitle.trim()}</dd>
          </div>
        ) : null}
        <div>
          <dt>Guests</dt>
          <dd>{guests}</dd>
        </div>
        {cancelDeadlineLabel ? (
          <div>
            <dt>Cancel until</dt>
            <dd>{cancelDeadlineLabel}</dd>
          </div>
        ) : (
          <div>
            <dt>Cancel until</dt>
            <dd>Not enabled by the organizer</dd>
          </div>
        )}
      </dl>

      {showDoorQr && checkInUrl.trim() ? (
        <RegistrationTicketQr
          checkInUrl={checkInUrl}
          name={attendeeName}
          size={168}
        />
      ) : null}

      {error ? (
        <p className="sf-event-ticket-types-error" role="alert">
          {error}
        </p>
      ) : null}

      {cancelOpen ? (
        <div className="sf-event-my-registration-actions">
          {canRequestRefund ? (
            <label className="settings-field settings-flag">
              <span>Also request a refund</span>
              <input
                type="checkbox"
                checked={requestRefund}
                onChange={(e) => setRequestRefund(e.target.checked)}
                disabled={isPending}
              />
              <span className="settings-hint">
                Unchecked by default. Refunds are confirmed requests only — Payments may
                still need to process them.
              </span>
            </label>
          ) : null}
          <div className="sf-event-detail-actions">
            <a className="sf-event-detail-action" href={eventHref}>
              Back to event
            </a>
            <button
              type="button"
              className="sf-event-detail-action is-primary"
              disabled={isPending}
              onClick={onCancel}
            >
              {isPending ? 'Cancelling…' : 'Cancel registration'}
            </button>
          </div>
        </div>
      ) : (
        <div className="sf-event-detail-actions">
          <a className="sf-event-detail-action" href={eventHref}>
            Back to event
          </a>
          <span className="sf-event-detail-action is-muted">
            {cancelClosedReason || 'Self-service cancel is closed.'}
          </span>
        </div>
      )}
    </section>
  )
}
