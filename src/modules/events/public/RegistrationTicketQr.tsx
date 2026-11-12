'use client'

import React from 'react'
import QRCode from 'react-qr-code'

type Props = {
  /** Absolute admin check-in URL encoded in the QR. */
  checkInUrl: string
  /** Optional attendee name shown under the code. */
  name?: string
  size?: number
}

/**
 * Door-staff QR for a confirmed registration — scan opens Events check-in.
 */
export function RegistrationTicketQr({ checkInUrl, name, size = 168 }: Props) {
  const value = checkInUrl.trim()
  if (!value) return null

  return (
    <div className="sf-event-ticket-qr" aria-label="Door check-in QR code">
      <div className="sf-event-ticket-qr-code">
        <QRCode value={value} size={size} />
      </div>
      {name?.trim() ? (
        <p className="sf-event-ticket-qr-name">{name.trim()}</p>
      ) : null}
      <p className="settings-hint sf-event-ticket-qr-hint">
        Show this code at the door. Staff scan it to open check-in for your ticket.
      </p>
    </div>
  )
}
