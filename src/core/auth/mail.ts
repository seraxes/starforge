/**
 * Auth outbound mail via the platform Mailer port (SF-17 / SF-96).
 * Never hard-code SMTP; secrets stay in env; Chrome enable/provider/From.
 */
import 'server-only'

import { sendMail } from '@/core/mail'
import { renderTransactionalMail } from '@/core/mail/transactional'
import type { MailSendResult } from '@/core/mail/types'

export type AuthMailKind =
  | 'password-reset'
  | 'magic-link'
  | 'email-otp'
  | 'email-verification'
  | 'account-reminder'
  | 'two-factor-otp'

function siteLabel(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'Starforge').replace(/^https?:\/\//, '')
}

/** Fire-and-forget friendly: logs soft failures; does not throw. */
export async function sendAuthMail(options: {
  to: string
  subject: string
  text: string
  html?: string
  kind: AuthMailKind
}): Promise<MailSendResult> {
  const rendered = options.html
    ? { text: options.text, html: options.html }
    : renderTransactionalMail(options.text.split('\n'))
  const result = await sendMail({
    to: options.to,
    subject: options.subject,
    text: rendered.text,
    html: rendered.html,
    meta: {
      emailType: 'system',
      title: options.kind,
      source: 'auth',
      moduleCategory: 'auth',
    },
  })
  if (!result.ok) {
    console.error(`[auth-mail:${options.kind}] send failed:`, result.error ?? result)
  }
  return result
}

export async function sendPasswordResetMail(options: {
  to: string
  name: string
  url: string
}): Promise<MailSendResult> {
  const text = [
    `Hi ${options.name || 'there'},`,
    '',
    'We received a request to reset your Starforge password.',
    `Open this link to choose a new password (expires soon):`,
    options.url,
    '',
    'If you did not ask for this, you can ignore this email.',
    '',
    `— ${siteLabel()}`,
  ].join('\n')
  return sendAuthMail({
    to: options.to,
    subject: 'Reset your Starforge password',
    text,
    kind: 'password-reset',
  })
}

export async function sendMagicLinkMail(options: {
  to: string
  url: string
}): Promise<MailSendResult> {
  const text = [
    'Sign in to Starforge without a password using this magic link:',
    options.url,
    '',
    'This link expires in a few minutes and can only be used once.',
    'If you did not request it, ignore this email.',
    '',
    `— ${siteLabel()}`,
  ].join('\n')
  return sendAuthMail({
    to: options.to,
    subject: 'Your Starforge sign-in link',
    text,
    kind: 'magic-link',
  })
}

export async function sendEmailVerificationMail(options: {
  to: string
  name: string
  url: string
}): Promise<MailSendResult> {
  const greeting = options.name?.trim() ? `Hi ${options.name.trim()},` : 'Hi,'
  const text = [
    greeting,
    '',
    'Confirm your Starforge email address by opening this link:',
    options.url,
    '',
    'The link expires in about an hour. After you verify, you can sign in.',
    'If you did not create an account, ignore this email.',
    '',
    `— ${siteLabel()}`,
  ].join('\n')
  return sendAuthMail({
    to: options.to,
    subject: 'Verify your Starforge email',
    text,
    kind: 'email-verification',
  })
}

export async function sendEmailOtpMail(options: {
  to: string
  otp: string
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email'
}): Promise<MailSendResult> {
  const purpose =
    options.type === 'sign-in'
      ? 'sign in'
      : options.type === 'forget-password'
        ? 'reset your password'
        : options.type === 'change-email'
          ? 'confirm your email change'
          : 'verify your email'
  const text = [
    `Your Starforge one-time code to ${purpose} is:`,
    '',
    options.otp,
    '',
    'It expires in a few minutes. Do not share it.',
    'If you did not request this, ignore this email.',
    '',
    `— ${siteLabel()}`,
  ].join('\n')
  return sendAuthMail({
    to: options.to,
    subject: `Your Starforge code (${purpose})`,
    text,
    kind: 'email-otp',
  })
}

export async function sendTwoFactorOtpMail(options: {
  to: string
  name: string
  otp: string
}): Promise<MailSendResult> {
  const text = [
    `Hi ${options.name || 'there'},`,
    '',
    'Your Starforge two-factor verification code is:',
    '',
    options.otp,
    '',
    'It expires shortly. If you did not try to sign in, secure your account.',
    '',
    `— ${siteLabel()}`,
  ].join('\n')
  return sendAuthMail({
    to: options.to,
    subject: 'Your Starforge 2FA code',
    text,
    kind: 'two-factor-otp',
  })
}

export async function sendAccountReminderMail(options: {
  to: string
  name: string
}): Promise<MailSendResult> {
  const text = [
    `Hi ${options.name || 'there'},`,
    '',
    'You asked for a reminder of your Starforge sign-in details.',
    '',
    `Sign-in email: ${options.to}`,
    options.name ? `Display name: ${options.name}` : null,
    '',
    'Sign in with that email (not the display name) at /login.',
    'If you did not request this reminder, you can ignore this email.',
    '',
    `— ${siteLabel()}`,
  ]
    .filter(Boolean)
    .join('\n')
  return sendAuthMail({
    to: options.to,
    subject: 'Your Starforge sign-in email',
    text,
    kind: 'account-reminder',
  })
}
