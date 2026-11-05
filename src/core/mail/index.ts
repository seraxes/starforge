import 'server-only'

import { getSiteChrome } from '@/core/site-chrome'

import { createConsoleMailer } from './console'
import { createDisabledMailer } from './disabled'
import { createResendMailer } from './resend'
import { resolveFrom } from './resolve-from'
import { createSmtpMailer } from './smtp'
import type {
  Mailer,
  MailerFactoryOptions,
  MailerInfo,
  MailMessage,
  MailSendResult,
} from './types'

export {
  MAIL_PROVIDERS,
  isMailProvider,
} from './types'
export type {
  MailAddress,
  Mailer,
  MailerFactoryOptions,
  MailerInfo,
  MailMessage,
  MailProvider,
  MailSendResult,
} from './types'
export { resolveFrom } from './resolve-from'

/**
 * Build a Mailer from explicit options (tests / callers that already loaded Chrome).
 */
export function createMailer(options: MailerFactoryOptions): Mailer {
  const from = resolveFrom(options.from)
  if (!options.enabled) {
    return createDisabledMailer(from)
  }
  switch (options.provider) {
    case 'smtp':
      return createSmtpMailer(from)
    case 'resend':
      return createResendMailer(from)
    case 'console':
    default:
      return createConsoleMailer(from)
  }
}

/**
 * Active Mailer from Site Chrome (+ env secrets).
 * Prefer this from product code (Forms notify, later auth mail).
 */
export async function getMailer(): Promise<Mailer> {
  const chrome = await getSiteChrome()
  return createMailer({
    enabled: chrome.emailEnabled,
    provider: chrome.emailProvider,
    from: chrome.emailFrom,
  })
}

export async function getMailerInfo(): Promise<MailerInfo> {
  const mailer = await getMailer()
  return mailer.info()
}

export async function sendMail(message: MailMessage): Promise<MailSendResult> {
  const mailer = await getMailer()
  return mailer.send(message)
}
