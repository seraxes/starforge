/**
 * Map Email Manager categories → Dashboard email.sent buckets.
 * Pure helpers — safe for unit tests without DB.
 */

import type { MailEmailType } from '@/core/mail/types'

import type { EmailModuleCategory } from './types'

export const EMAIL_SEND_TYPES = ['transactional', 'marketing', 'system'] as const

export type EmailSendType = (typeof EMAIL_SEND_TYPES)[number]

export function isEmailSendType(value: unknown): value is EmailSendType {
  return (
    typeof value === 'string' &&
    (EMAIL_SEND_TYPES as readonly string[]).includes(value)
  )
}

/**
 * Dashboard type from a module category (rules/templates filter).
 * social / marketplace → marketing; system → system; everything else → transactional.
 */
export function emailTypeFromModuleCategory(
  category: EmailModuleCategory | string | null | undefined,
): EmailSendType {
  const cat = (category || '').trim().toLowerCase()
  if (cat === 'system') return 'system'
  if (cat === 'social' || cat === 'marketplace') return 'marketing'
  return 'transactional'
}

/** Normalize optional Mailer meta type, falling back via module category. */
export function resolveEmailSendType(options: {
  emailType?: MailEmailType | string | null
  moduleCategory?: string | null
}): EmailSendType {
  if (isEmailSendType(options.emailType)) return options.emailType
  return emailTypeFromModuleCategory(options.moduleCategory)
}
