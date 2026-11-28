import { getTranslations } from 'next-intl/server'
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
export async function CheckoutHandoff({
  paymentReference,
  methodLabel,
  currency,
  totalGrossMinor,
  instructions,
  status,
}: Props) {
  const t = await getTranslations('product:payments')
  const amount = formatMoneyMinor(totalGrossMinor, currency)
  return (
    <div className="sf-checkout-handoff">
      <h1 className="sf-checkout-handoff-title">{t('completePayment')}</h1>
      <p className="sf-checkout-handoff-lede settings-hint">
        {status === 'awaiting_offline' ? t('seatHeldLede') : t('awaitingPaymentLede')}
      </p>
      <dl className="sf-checkout-handoff-meta">
        <div>
          <dt>{t('reference')}</dt>
          <dd>
            <code>{paymentReference}</code>
          </dd>
        </div>
        <div>
          <dt>{t('amount')}</dt>
          <dd>{amount}</dd>
        </div>
        <div>
          <dt>{t('method')}</dt>
          <dd>{methodLabel}</dd>
        </div>
      </dl>
      {instructions.trim() ? (
        <pre className="sf-checkout-handoff-instructions">{instructions.trim()}</pre>
      ) : null}
    </div>
  )
}
