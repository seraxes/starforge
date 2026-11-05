/**
 * Wrap a Mailer so every send attempt is soft-recorded to sf_email_sends.
 * Dynamic-imports the Email Manager writer — Core stays free of a hard module dep.
 */

import 'server-only'

import type { Mailer, MailMessage, MailSendResult } from './types'

async function softRecordSend(message: MailMessage, result: MailSendResult): Promise<void> {
  try {
    const { recordEmailSend } = await import('@/modules/email-manager/send-log')
    await recordEmailSend({ message, result })
  } catch {
    // Pack missing / import failure — ignore.
  }
}

/** Return a Mailer that logs after each send (success, fail, or skipped). */
export function withEmailSendLog(mailer: Mailer): Mailer {
  return {
    info: () => mailer.info(),
    async send(message: MailMessage): Promise<MailSendResult> {
      const result = await mailer.send(message)
      // Await so serverless runtimes don't drop the write; still soft-fail inside.
      await softRecordSend(message, result)
      return result
    },
  }
}
