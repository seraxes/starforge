import React from 'react'

import { formatMoneyMinor } from '@/core/payments'

type Props = {
  paymentReference: string
  methodLabel: string
  currency: string
  totalGrossMinor: number
  instructions: string
  status: string
}

/**
 * Offline / awaiting payment instructions for a public checkout handoff.
 */
export function CheckoutHandoff({
  paymentReference,
  methodLabel,
  currency,
  totalGrossMinor,
  instructions,
  status,
}: Props) {
  const amount = formatMoneyMinor(totalGrossMinor, currency)
  return (
    <div className="sf-checkout-handoff">
      <h1 className="sf-checkout-handoff-title">Complete your payment</h1>
      <p className="sf-checkout-handoff-lede settings-hint">
        {status === 'awaiting_offline'
          ? 'Your seat is held. Follow the instructions below — staff will confirm when payment is received.'
          : 'Your order is waiting for payment.'}
      </p>
      <dl className="sf-checkout-handoff-meta">
        <div>
          <dt>Reference</dt>
          <dd>
            <code>{paymentReference}</code>
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{amount}</dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd>{methodLabel}</dd>
        </div>
      </dl>
      {instructions.trim() ? (
        <pre className="sf-checkout-handoff-instructions">{instructions.trim()}</pre>
      ) : null}
    </div>
  )
}
