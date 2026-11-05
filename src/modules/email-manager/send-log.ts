/**
 * Durable Email Manager send log writer.
 * Soft-fails always — never throws into Mailer / form / auth paths.
 */

import 'server-only'

import type { MailMessage, MailSendResult } from '@/core/mail/types'

import { resolveEmailSendType } from './send-type'
import { sfEmailSends } from './schema'

export type EmailSendStatus = 'sent' | 'failed' | 'skipped'

function recipients(to: MailMessage['to']): string[] {
  return (Array.isArray(to) ? to : [to]).map((e) => e.trim()).filter(Boolean)
}

export function statusFromMailResult(result: MailSendResult): EmailSendStatus {
  if (result.skipped) return 'skipped'
  if (result.ok) return 'sent'
  return 'failed'
}

export type RecordEmailSendInput = {
  message: MailMessage
  result: MailSendResult
}

/**
 * Persist one send attempt. Missing table / DB errors are swallowed.
 */
export async function recordEmailSend(input: RecordEmailSendInput): Promise<void> {
  try {
    const { db } = await import('@/core/db')
    const meta = input.message.meta
    const to = recipients(input.message.to).join(', ').slice(0, 2000)
    const subject = (input.message.subject || '').trim().slice(0, 500)
    const title = (meta?.title || '').trim().slice(0, 200) || null
    const emailType = resolveEmailSendType({
      emailType: meta?.emailType,
      moduleCategory: meta?.moduleCategory,
    })
    const status = statusFromMailResult(input.result)
    const error = (input.result.error || '').trim().slice(0, 1000) || null

    await db.insert(sfEmailSends).values({
      id: crypto.randomUUID(),
      status,
      emailType,
      provider: input.result.provider || 'console',
      toAddress: to,
      subject,
      title,
      error,
      source: (meta?.source || '').trim().slice(0, 80) || null,
      ruleId: (meta?.ruleId || '').trim().slice(0, 80) || null,
      templateId: (meta?.templateId || '').trim().slice(0, 80) || null,
      moduleCategory: (meta?.moduleCategory || '').trim().slice(0, 40) || null,
      providerMessageId: (input.result.id || '').trim().slice(0, 200) || null,
    })
  } catch (error) {
    // Soft-fail: missing migration / pool down must not break outbound mail.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[email-send-log] record failed',
        error instanceof Error ? error.message : error,
      )
    }
  }
}
