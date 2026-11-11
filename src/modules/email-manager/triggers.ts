/**
 * Built-in Email Manager trigger registry.
 * Modules emit these keys; admin binds rules. Auth Mailer paths stay direct until ready.
 */

import type { EmailTriggerDef } from './types'

export const BUILTIN_EMAIL_TRIGGERS: readonly EmailTriggerDef[] = [
  {
    key: 'product:forms/submitted',
    label: 'Form submitted',
    moduleCategory: 'forms',
    moduleId: 'product:forms',
    description:
      'Fired after a successful Form definition submit (alongside legacy per-form notify).',
    payloadFields: [
      'formKey',
      'definitionId',
      'formTitle',
      'preset',
      'payload',
      'payloadText',
      'notifyAdmin',
      'notifyRespondent',
      'adminEmails',
      'respondentEmail',
      'submissionId',
    ],
  },
  {
    key: 'product:forms/test',
    label: 'Form test notify',
    moduleCategory: 'forms',
    moduleId: 'product:forms',
    description: 'Admin test send from Forms settings / Email Manager.',
    payloadFields: ['formTitle', 'payloadText', 'adminEmails', 'respondentEmail'],
  },
  {
    key: 'platform:auth/password-reset',
    label: 'Password reset (registered)',
    moduleCategory: 'auth',
    moduleId: 'platform:better-auth',
    description:
      'Registered for future rule binding — Auth still sends via Core Mailer helpers in v1.',
    payloadFields: ['email', 'url', 'userName'],
  },
  {
    key: 'platform:auth/magic-link',
    label: 'Magic link (registered)',
    moduleCategory: 'auth',
    moduleId: 'platform:better-auth',
    description: 'Registered for future rule binding — Auth Mailer path unchanged in v1.',
    payloadFields: ['email', 'url'],
  },
  {
    key: 'system:test',
    label: 'Email Manager test send',
    moduleCategory: 'system',
    moduleId: 'product:email-manager',
    description: 'Admin test send from Email Manager (does not require a rule).',
    payloadFields: ['to', 'subject', 'body', 'note'],
  },
  {
    key: 'product:events/registered',
    label: 'Event registered',
    moduleCategory: 'events',
    moduleId: 'product:events',
    description:
      'Fired after Forms event-registration onSubmitted creates an attendee row (registered or waitlisted).',
    payloadFields: [
      'eventId',
      'eventTitle',
      'eventSlug',
      'registrationId',
      'registrationStatus',
      'ticketTierId',
      'ticketTierTitle',
      'name',
      'email',
      'guests',
      'attendance',
      'submissionId',
      'respondentEmail',
    ],
  },
  {
    key: 'product:events/waitlist-promoted',
    label: 'Waitlist promoted',
    moduleCategory: 'events',
    moduleId: 'product:events',
    description:
      'Fired when a waitlisted registration is FIFO-promoted into a registered seat.',
    payloadFields: [
      'eventId',
      'eventTitle',
      'eventSlug',
      'registrationId',
      'registrationStatus',
      'ticketTierId',
      'ticketTierTitle',
      'name',
      'email',
      'guests',
      'attendance',
      'respondentEmail',
    ],
  },
  {
    key: 'product:payments/checkout_started',
    label: 'Checkout started',
    moduleCategory: 'payments',
    moduleId: 'product:payments',
    description: 'Fired when a payments checkout/order is created.',
    payloadFields: [
      'orderId',
      'buyerEmail',
      'method',
      'currency',
      'totalGrossMinor',
      'totalGrossFormatted',
      'paymentReference',
    ],
  },
  {
    key: 'product:payments/awaiting_offline',
    label: 'Awaiting offline payment',
    moduleCategory: 'payments',
    moduleId: 'product:payments',
    description: 'Bank transfer / pay at entrance / cash — includes payment reference and instructions.',
    payloadFields: [
      'orderId',
      'buyerEmail',
      'method',
      'paymentReference',
      'instructions',
      'currency',
      'totalGrossMinor',
      'totalGrossFormatted',
    ],
  },
  {
    key: 'product:payments/paid',
    label: 'Payment received',
    moduleCategory: 'payments',
    moduleId: 'product:payments',
    description: 'Order marked paid (provider verify or staff confirm). Receipt trigger.',
    payloadFields: [
      'orderId',
      'buyerEmail',
      'method',
      'currency',
      'totalGrossMinor',
      'totalGrossFormatted',
      'paidAt',
      'invoiceId',
      'paymentReference',
      'lineSummary',
    ],
  },
  {
    key: 'product:payments/invoice_issued',
    label: 'Invoice issued',
    moduleCategory: 'payments',
    moduleId: 'product:payments',
    description: 'Invoice number allocated after paid (NAV-ready tax lines).',
    payloadFields: [
      'orderId',
      'invoiceId',
      'invoiceNumber',
      'buyerEmail',
      'currency',
      'totalGrossMinor',
      'totalGrossFormatted',
      'sellerVatId',
      'buyerVatId',
    ],
  },
  {
    key: 'product:payments/refunded',
    label: 'Payment refunded',
    moduleCategory: 'payments',
    moduleId: 'product:payments',
    description: 'Refund / credit note issued.',
    payloadFields: [
      'orderId',
      'buyerEmail',
      'refundAmountMinor',
      'creditNoteId',
      'currency',
    ],
  },
  {
    key: 'product:payments/failed',
    label: 'Payment failed',
    moduleCategory: 'payments',
    moduleId: 'product:payments',
    description: 'Provider reported failure.',
    payloadFields: ['orderId', 'buyerEmail', 'reason'],
  },
  {
    key: 'product:payments/expired',
    label: 'Checkout expired / cancelled',
    moduleCategory: 'payments',
    moduleId: 'product:payments',
    description: 'TTL expiry or buyer cancelled provider checkout.',
    payloadFields: ['orderId', 'buyerEmail', 'reason'],
  },
] as const

const BY_KEY = new Map(BUILTIN_EMAIL_TRIGGERS.map((t) => [t.key, t]))

export function getEmailTrigger(key: string): EmailTriggerDef | undefined {
  return BY_KEY.get(key.trim())
}

export function listEmailTriggers(filter?: {
  moduleCategory?: string
}): EmailTriggerDef[] {
  const cat = filter?.moduleCategory?.trim()
  if (!cat || cat === 'all') return [...BUILTIN_EMAIL_TRIGGERS]
  return BUILTIN_EMAIL_TRIGGERS.filter((t) => t.moduleCategory === cat)
}

export function isKnownEmailTriggerKey(key: string): boolean {
  return BY_KEY.has(key.trim())
}
