import 'server-only'

import type { Mailer, MailerInfo, MailMessage, MailSendResult } from './types'

function recipients(to: MailMessage['to']): string[] {
  return (Array.isArray(to) ? to : [to]).map((e) => e.trim()).filter(Boolean)
}

function resendApiKey(): string {
  return (process.env.RESEND_API_KEY ?? '').trim()
}

export function resendReadyDetail(): { ready: boolean; detail: string } {
  if (!resendApiKey()) {
    return { ready: false, detail: 'Set RESEND_API_KEY in env (never in Chrome).' }
  }
  return { ready: true, detail: 'Resend HTTP API' }
}

/** Resend-style HTTP adapter — API key from env only. */
export function createResendMailer(from: string): Mailer {
  const readiness = resendReadyDetail()

  return {
    info(): MailerInfo {
      return {
        provider: 'resend',
        label: 'Resend',
        enabled: true,
        ready: readiness.ready,
        from,
        detail: readiness.detail,
      }
    },
    async send(message: MailMessage): Promise<MailSendResult> {
      const to = recipients(message.to)
      if (!to.length) {
        return { ok: false, provider: 'resend', error: 'No recipients.', skipped: true }
      }
      if (!readiness.ready) {
        return { ok: false, provider: 'resend', error: readiness.detail, skipped: true }
      }

      const resolvedFrom = (message.from || from || '').trim()
      if (!resolvedFrom) {
        return {
          ok: false,
          provider: 'resend',
          error: 'No From address — set Chrome email From or STARFORGE_MAIL_FROM.',
          skipped: true,
        }
      }

      const apiKey = resendApiKey()
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: resolvedFrom,
            to,
            subject: message.subject,
            text: message.text,
            html: message.html,
            reply_to: message.replyTo,
          }),
        })
        const body = (await res.json().catch(() => null)) as
          | { id?: string; message?: string; name?: string }
          | null
        if (!res.ok) {
          const err =
            (body && typeof body.message === 'string' && body.message) ||
            `Resend HTTP ${res.status}`
          return { ok: false, provider: 'resend', error: err }
        }
        return {
          ok: true,
          provider: 'resend',
          id: body && typeof body.id === 'string' ? body.id : undefined,
        }
      } catch (error) {
        const err =
          error instanceof Error && error.message
            ? error.message
            : 'Resend send failed.'
        return { ok: false, provider: 'resend', error: err }
      }
    },
  }
}
