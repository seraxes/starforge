import 'server-only'

import nodemailer from 'nodemailer'

import type { Mailer, MailerInfo, MailMessage, MailSendResult } from './types'

function recipients(to: MailMessage['to']): string[] {
  return (Array.isArray(to) ? to : [to]).map((e) => e.trim()).filter(Boolean)
}

function smtpEnv() {
  const host = (process.env.SMTP_HOST ?? '').trim()
  const portRaw = (process.env.SMTP_PORT ?? '587').trim()
  const port = Number.parseInt(portRaw, 10)
  const user = (process.env.SMTP_USER ?? '').trim()
  const pass = process.env.SMTP_PASS ?? ''
  const secureRaw = (process.env.SMTP_SECURE ?? '').trim().toLowerCase()
  const secure = secureRaw === '1' || secureRaw === 'true' || secureRaw === 'yes'
  return { host, port: Number.isFinite(port) ? port : 587, user, pass, secure }
}

export function smtpReadyDetail(): { ready: boolean; detail: string } {
  const { host, user, pass } = smtpEnv()
  if (!host) {
    return { ready: false, detail: 'Set SMTP_HOST (and usually SMTP_USER / SMTP_PASS) in env.' }
  }
  if (user && !pass) {
    return { ready: false, detail: 'SMTP_USER is set but SMTP_PASS is empty.' }
  }
  return { ready: true, detail: `SMTP via ${host}` }
}

/** SMTP adapter — secrets from env only. */
export function createSmtpMailer(from: string): Mailer {
  const readiness = smtpReadyDetail()

  return {
    info(): MailerInfo {
      return {
        provider: 'smtp',
        label: 'SMTP',
        enabled: true,
        ready: readiness.ready,
        from,
        detail: readiness.detail,
      }
    },
    async send(message: MailMessage): Promise<MailSendResult> {
      const to = recipients(message.to)
      if (!to.length) {
        return { ok: false, provider: 'smtp', error: 'No recipients.', skipped: true }
      }
      if (!readiness.ready) {
        return { ok: false, provider: 'smtp', error: readiness.detail, skipped: true }
      }

      const resolvedFrom = (message.from || from || '').trim()
      if (!resolvedFrom) {
        return {
          ok: false,
          provider: 'smtp',
          error: 'No From address — set Site Chrome email From or STARFORGE_MAIL_FROM.',
          skipped: true,
        }
      }

      const { host, port, user, pass, secure } = smtpEnv()
      try {
        const transport = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: user ? { user, pass } : undefined,
        })
        const info = await transport.sendMail({
          from: resolvedFrom,
          to: to.join(', '),
          subject: message.subject,
          text: message.text,
          html: message.html,
          replyTo: message.replyTo,
        })
        return {
          ok: true,
          provider: 'smtp',
          id: typeof info.messageId === 'string' ? info.messageId : undefined,
        }
      } catch (error) {
        const err =
          error instanceof Error && error.message
            ? error.message
            : 'SMTP send failed.'
        return { ok: false, provider: 'smtp', error: err }
      }
    },
  }
}
