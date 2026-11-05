/**
 * Mailer infrastructure port (SF-96).
 *
 * Product code (Forms notify, later forgot-password) calls `send` only.
 * Site Chrome selects enable + provider + From; secrets stay in env.
 *
 * Client-safe types + provider list — adapters live in server-only modules.
 */

export type MailProvider = 'console' | 'smtp' | 'resend'

export const MAIL_PROVIDERS: Array<{ value: MailProvider; label: string }> = [
  { value: 'console', label: 'Console (dev)' },
  { value: 'smtp', label: 'SMTP' },
  { value: 'resend', label: 'Resend' },
]

const MAIL_PROVIDER_SET = new Set<MailProvider>(MAIL_PROVIDERS.map((p) => p.value))

export function isMailProvider(value: unknown): value is MailProvider {
  return typeof value === 'string' && MAIL_PROVIDER_SET.has(value as MailProvider)
}

export type MailAddress = string

export type MailMessage = {
  to: MailAddress | MailAddress[]
  /** Overrides Site Chrome / env From when set. */
  from?: MailAddress
  subject: string
  text: string
  html?: string
  replyTo?: MailAddress
}

export type MailSendResult = {
  ok: boolean
  /** Provider that handled (or refused) the send. */
  provider: MailProvider | 'disabled'
  /** Vendor message id when available. */
  id?: string
  /** Soft failure detail — callers must not treat as fatal for form submit. */
  error?: string
  /** True when Chrome email is off or provider refused before network. */
  skipped?: boolean
}

export type MailerInfo = {
  provider: MailProvider | 'disabled'
  label: string
  enabled: boolean
  ready: boolean
  /** Default From resolved from Chrome / env (may be empty). */
  from: string
  detail?: string
}

export interface Mailer {
  send(message: MailMessage): Promise<MailSendResult>
  info(): MailerInfo
}

export type MailerFactoryOptions = {
  enabled: boolean
  provider: MailProvider
  /** Site Chrome default From (may be missing on older/cached chrome). */
  from?: string | null
}
