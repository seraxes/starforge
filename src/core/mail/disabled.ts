import type { Mailer, MailerInfo, MailMessage, MailSendResult } from './types'

/** No-op when Site Chrome email is disabled. */
export function createDisabledMailer(from = ''): Mailer {
  return {
    info(): MailerInfo {
      return {
        provider: 'disabled',
        label: 'Disabled',
        enabled: false,
        ready: false,
        from,
        detail: 'Turn on email under Chrome to send.',
      }
    },
    async send(_message: MailMessage): Promise<MailSendResult> {
      return {
        ok: false,
        provider: 'disabled',
        skipped: true,
        error: 'Outbound email is disabled in Chrome.',
      }
    },
  }
}
