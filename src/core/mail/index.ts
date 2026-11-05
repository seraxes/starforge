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
import { withEmailSendLog } from './with-send-log'

export {
  MAIL_PROVIDERS,
  isMailProvider,
} from './types'
export type {
  MailAddress,
  MailEmailType,
  Mailer,
  MailerFactoryOptions,
  MailerInfo,
  MailMessage,
  MailProvider,
  MailSendMeta,
  MailSendResult,
} from './types'
export { resolveFrom } from './resolve-from'
export { withEmailSendLog } from './with-send-log'

/**
 * Build a Mailer from explicit options (tests / callers that already loaded Chrome).
 * Every send is soft-logged to `sf_email_sends` when the Email Manager pack is present.
 */
export function createMailer(options: MailerFactoryOptions): Mailer {
  const from = resolveFrom(options.from)
  let mailer: Mailer
  if (!options.enabled) {
    mailer = createDisabledMailer(from)
  } else {
    switch (options.provider) {
      case 'smtp':
        mailer = createSmtpMailer(from)
        break
      case 'resend':
        mailer = createResendMailer(from)
        break
      case 'console':
      default:
        mailer = createConsoleMailer(from)
        break
    }
  }
  return withEmailSendLog(mailer)
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
