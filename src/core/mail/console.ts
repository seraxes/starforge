import type { Mailer, MailerInfo, MailMessage, MailSendResult } from './types'

function recipients(to: MailMessage['to']): string[] {
  return (Array.isArray(to) ? to : [to]).map((e) => e.trim()).filter(Boolean)
}

/**
 * Local/dev adapter — logs the message; never hits the network.
 * Default when Site Chrome provider is `console` or secrets are missing for other providers.
 */
export function createConsoleMailer(from: string): Mailer {
  return {
    info(): MailerInfo {
      return {
        provider: 'console',
        label: 'Console (dev)',
        enabled: true,
        ready: true,
        from,
        detail: 'Logs outbound mail to the server console. No network send.',
      }
    },
    async send(message: MailMessage): Promise<MailSendResult> {
      const to = recipients(message.to)
      if (!to.length) {
        return { ok: false, provider: 'console', error: 'No recipients.', skipped: true }
      }
      const resolvedFrom = (message.from || from || 'noreply@localhost').trim()
      console.info(
        '[mail:console]',
        JSON.stringify({
          from: resolvedFrom,
          to,
          subject: message.subject,
          textPreview: message.text.slice(0, 240),
        }),
      )
      return { ok: true, provider: 'console', id: `console-${Date.now()}` }
    },
  }
}
