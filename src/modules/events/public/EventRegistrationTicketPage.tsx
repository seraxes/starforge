import React from 'react'

import { RegistrationTicketQr } from './RegistrationTicketQr'

type Props = {
  eventTitle: string
  eventWhenLabel: string
  name: string
  tierTitle: string
  guests: number
  checkInUrl: string
  eventHref?: string
}

/** Public ticket surface for a confirmed registration (email link + offline show). */
export function EventRegistrationTicketPage({
  eventTitle,
  eventWhenLabel,
  name,
  tierTitle,
  guests,
  checkInUrl,
  eventHref,
}: Props) {
  return (
    <article className="sf-event-detail sf-event-registration-ticket">
      <header className="sf-event-detail-header">
        {eventHref ? (
          <p className="sf-event-detail-kicker">
            <a href={eventHref}>← {eventTitle}</a>
          </p>
        ) : (
          <p className="sf-event-detail-kicker">{eventTitle}</p>
        )}
        <h1 className="sf-event-detail-title">Your ticket</h1>
        <p className="lede">Confirmed registration — show this QR at the door.</p>
      </header>

      <section className="sf-event-my-registration" aria-label="Ticket">
        <dl className="sf-event-my-registration-facts">
          <div>
            <dt>Name</dt>
            <dd>{name || '—'}</dd>
          </div>
          <div>
            <dt>Event</dt>
            <dd>{eventTitle}</dd>
          </div>
          {eventWhenLabel ? (
            <div>
              <dt>When</dt>
              <dd>{eventWhenLabel}</dd>
            </div>
          ) : null}
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
        </dl>

        <RegistrationTicketQr checkInUrl={checkInUrl} name={name} size={192} />
      </section>
    </article>
  )
}
