import React from 'react'

import { formatMoneyMinor } from '@/core/payments'

type Props = {
  paymentReference: string
  method: string
  currency: string
  totalGrossMinor: number
  instructions: string
  status: string
}

function methodLabel(method: string): string {
  switch (method) {
    case 'bank_transfer':
      return 'Bank transfer'
    case 'pay_at_entrance':
      return 'Pay at entrance'
    case 'cash':
      return 'Cash'
    case 'barion':
      return 'Barion'
    case 'stripe':
      return 'Card (Stripe)'
    case 'paypal':
      return 'PayPal'
    default:
      return method
  }
}

/**
 * Offline / awaiting payment instructions for a public checkout handoff.
 */
export function CheckoutHandoff({
  paymentReference,
  method,
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
          <dd>{methodLabel(method)}</dd>
        </div>
      </dl>
      {instructions.trim() ? (
        <pre className="sf-checkout-handoff-instructions">{instructions.trim()}</pre>
      ) : null}
    </div>
  )
}
